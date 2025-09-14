// Get JWT token from local storage
function getToken() {
    return localStorage.getItem('uav_token');
}

let currentPage = 1;
let searchQuery = {};
let flightsCache = [];

// Load flights with pagination and optional filters
async function loadFlights(page = 1) {
    currentPage = page;
    const token = getToken();

    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Use the correct API endpoint - check if it should be /history or not
    let query = `?page=${page}&limit=10`;
    if (searchQuery.name) query += `&name=${encodeURIComponent(searchQuery.name)}`;
    if (searchQuery.date) query += `&date=${encodeURIComponent(searchQuery.date)}`;

    try {
        // Try with /history first, fallback to without if it fails
        let apiUrl = `/api/flights${query}`;
        let res = await fetch(apiUrl, {
            headers: { Authorization: 'Bearer ' + token }
        });

        // If 404, try without /history
        if (res.status === 404) {
            apiUrl = `/api/flights${query}`;
            res = await fetch(apiUrl, {
                headers: { Authorization: 'Bearer ' + token }
            });
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load flights');

        flightsCache = data.flights || [];
        renderFlights(data.flights || []);
        renderPagination(data.pagination || { total: 1, current: 1 });
    } catch (err) {
        console.error('Load flights error:', err);
        M.toast({ html: `Error: ${err.message}`, classes: 'red' });

        // Show empty state
        renderFlights([]);
        renderPagination({ total: 1, current: 1 });
    }
}

// Render flights table with enhanced trajectory analysis data
function renderFlights(flights) {
    const tbody = $('#flightsTableBody');
    tbody.empty();

    if (!flights || flights.length === 0) {
        tbody.append(`
            <tr>
                <td colspan="7" class="center-align grey-text">No flights found</td>
            </tr>
        `);
        return;
    }

    flights.forEach(f => {
        // Safe property access with fallbacks
        const flightName = f.flightName || 'Unnamed Flight';
        const flightId = f.id || f._id;
        const uploadDate = f.uploadDate || f.createdAt || new Date();
        const totalPoints = f.totalPoints || 0;
        const averageError = f.averageError || f.avgAccuracy || 0;
        const responseTime = f.responseTime || 0;

        // Format accuracy - convert from error to display format
        let accuracyDisplay = 'N/A';
        if (averageError !== undefined && averageError !== null && !isNaN(averageError)) {
            if (averageError < 0.1) {
                // Show in millimeters for small errors
                const errorInMm = averageError * 1000;
                accuracyDisplay = `${errorInMm.toFixed(1)}mm`;
            } else {
                // Show in meters for larger errors
                accuracyDisplay = `${averageError.toFixed(3)}m`;
            }
        }

        // Format response time
        let responseTimeDisplay = 'N/A';
        if (responseTime !== undefined && responseTime !== null && !isNaN(responseTime)) {
            if (responseTime > 1000) {
                responseTimeDisplay = `${(responseTime/1000).toFixed(1)}s`;
            } else {
                responseTimeDisplay = `${Math.round(responseTime)}ms`;
            }
        }

        // Safe string escaping for onclick handlers
        const safeFlightName = flightName.replace(/'/g, "\\'").replace(/"/g, '\\"');

        tbody.append(`
            <tr>
                <td>
                    <label>
                        <input type="checkbox" class="select-flight" data-id="${flightId}">
                        <span></span>
                    </label>
                </td>
                <td>${flightName}</td>
                <td>${new Date(uploadDate).toLocaleDateString()}</td>
                <td>${totalPoints}</td>
                <td>${accuracyDisplay}</td>
                <td>${responseTimeDisplay}</td>
                <td>
                    <a class="btn-small blue waves-effect" href="/visualization?flightId=${flightId}">
                        <i class="material-icons left">3d_rotation</i>View
                    </a>
                    <a class="btn-small green waves-effect" href="/analysis?flightId=${flightId}">
                        <i class="material-icons left">analytics</i>Analyze
                    </a>
                    <button class="btn-small orange waves-effect" onclick="editFlight('${flightId}', '${safeFlightName}')">
                        <i class="material-icons left">edit</i>Edit
                    </button>
                    <button class="btn-small red waves-effect" onclick="deleteFlight('${flightId}')">
                        <i class="material-icons left">delete</i>Delete
                    </button>
                </td>
            </tr>
        `);
    });
}

// Render pagination controls - with safety checks
function renderPagination(pagination) {
    const ul = $('#pagination');
    ul.empty();

    if (!pagination || pagination.total <= 1) return;

    const current = pagination.current || 1;
    const total = pagination.total || 1;
    const hasPrev = pagination.hasPrev !== undefined ? pagination.hasPrev : current > 1;
    const hasNext = pagination.hasNext !== undefined ? pagination.hasNext : current < total;

    if (hasPrev) {
        ul.append(`<li class="waves-effect"><a href="javascript:void(0)" onclick="loadFlights(${current - 1})"><i class="material-icons">chevron_left</i></a></li>`);
    }

    // Smart pagination - show max 5 pages around current
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(total, current + 2);

    if (startPage > 1) {
        ul.append(`<li class="waves-effect"><a href="javascript:void(0)" onclick="loadFlights(1)">1</a></li>`);
        if (startPage > 2) ul.append(`<li class="disabled"><a href="javascript:void(0)">...</a></li>`);
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === current ? 'active teal' : 'waves-effect';
        ul.append(`<li class="${activeClass}"><a href="javascript:void(0)" onclick="loadFlights(${i})">${i}</a></li>`);
    }

    if (endPage < total) {
        if (endPage < total - 1) ul.append(`<li class="disabled"><a href="javascript:void(0)">...</a></li>`);
        ul.append(`<li class="waves-effect"><a href="javascript:void(0)" onclick="loadFlights(${total})">${total}</a></li>`);
    }

    if (hasNext) {
        ul.append(`<li class="waves-effect"><a href="javascript:void(0)" onclick="loadFlights(${current + 1})"><i class="material-icons">chevron_right</i></a></li>`);
    }
}

// Delete single flight with confirmation
async function deleteFlight(id) {
    if (!id) {
        M.toast({ html: 'Invalid flight ID', classes: 'red' });
        return;
    }

    if (!confirm('Are you sure you want to delete this flight? This action cannot be undone.')) return;

    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const res = await fetch(`/api/flights/${id}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Delete failed');

        M.toast({ html: 'Flight deleted successfully', classes: 'green' });
        loadFlights(currentPage);

        // Clear selection if deleted flight was selected
        $(`.select-flight[data-id="${id}"]`).prop('checked', false);
        if (typeof updateSelectAllState === 'function') {
            updateSelectAllState();
        }
    } catch (err) {
        console.error('Delete flight error:', err);
        M.toast({ html: `Delete failed: ${err.message}`, classes: 'red' });
    }
}

// Edit flight name with improved validation
function editFlight(id, currentName) {
    if (!id) {
        M.toast({ html: 'Invalid flight ID', classes: 'red' });
        return;
    }

    const newName = prompt('Enter new flight name:', currentName || '');
    if (!newName || newName.trim() === '' || newName === currentName) return;

    const trimmedName = newName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
        M.toast({ html: 'Flight name must be between 1 and 100 characters', classes: 'red' });
        return;
    }

    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }

    fetch(`/api/flights/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ flightName: trimmedName })
    })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (!data.success) throw new Error(data.message || 'Update failed');
            M.toast({ html: 'Flight updated successfully', classes: 'green' });
            loadFlights(currentPage);
        })
        .catch(err => {
            console.error('Edit flight error:', err);
            M.toast({ html: `Update failed: ${err.message}`, classes: 'red' });
        });
}

// Enhanced bulk delete with progress indication
async function bulkDelete() {
    const selectedIds = $('.select-flight:checked').map((_, el) => $(el).data('id')).get();
    if (!selectedIds.length) {
        M.toast({ html: 'Please select at least one flight to delete', classes: 'orange' });
        return;
    }

    if (!confirm(`Delete ${selectedIds.length} selected flight(s)? This action cannot be undone.`)) return;

    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }

    let successCount = 0;
    let failCount = 0;

    // Show progress toast
    M.toast({ html: `Deleting ${selectedIds.length} flights...`, classes: 'blue' });

    for (const id of selectedIds) {
        try {
            const res = await fetch(`/api/flights/${id}`, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                failCount++;
            }
        } catch (err) {
            console.error('Bulk delete error:', err);
            failCount++;
        }
    }

    // Show results
    if (successCount > 0) {
        M.toast({ html: `${successCount} flight(s) deleted successfully`, classes: 'green' });
    }
    if (failCount > 0) {
        M.toast({ html: `${failCount} flight(s) failed to delete`, classes: 'red' });
    }

    // Refresh list and clear selections
    loadFlights(currentPage);
    $('#selectAll').prop('checked', false);
}

// Enhanced bulk export with better CSV formatting
function bulkExport() {
    const selectedIds = $('.select-flight:checked').map((_, el) => $(el).data('id')).get();
    const selectedFlights = flightsCache.filter(f => selectedIds.includes(f.id || f._id));

    if (!selectedFlights.length) {
        M.toast({ html: 'Please select at least one flight to export', classes: 'orange' });
        return;
    }

    // Enhanced CSV with more data columns
    let csv = "Flight Name,Upload Date,Total Points,Average Error (m),Response Time (s)\n";

    selectedFlights.forEach(f => {
        const flightName = (f.flightName || 'Unnamed').replace(/"/g, '""'); // Escape quotes
        const uploadDate = new Date(f.uploadDate || f.createdAt || new Date()).toISOString().split('T')[0];
        const totalPoints = f.totalPoints || 0;
        const avgError = (f.averageError || f.avgAccuracy || 0).toFixed(4);
        const responseTime = ((f.responseTime || 0) / 1000).toFixed(2);

        csv += `"${flightName}","${uploadDate}",${totalPoints},"${avgError}","${responseTime}"\n`;
    });

    // Create and download file
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uav_flights_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        M.toast({ html: `${selectedFlights.length} flight(s) exported successfully`, classes: 'green' });
    } catch (error) {
        console.error('Export error:', error);
        M.toast({ html: 'Export failed', classes: 'red' });
    }
}

// Update select all state based on individual selections
function updateSelectAllState() {
    const totalCheckboxes = $('.select-flight').length;
    const checkedCheckboxes = $('.select-flight:checked').length;

    const selectAllEl = $('#selectAll');
    if (selectAllEl.length === 0) return; // Element doesn't exist

    if (checkedCheckboxes === 0) {
        selectAllEl.prop('indeterminate', false).prop('checked', false);
    } else if (checkedCheckboxes === totalCheckboxes) {
        selectAllEl.prop('indeterminate', false).prop('checked', true);
    } else {
        selectAllEl.prop('indeterminate', true);
    }

    // Update bulk action button states
    const hasSelection = checkedCheckboxes > 0;
    $('#bulkDeleteBtn').toggleClass('disabled', !hasSelection);
    $('#bulkExportBtn').toggleClass('disabled', !hasSelection);
}

// Logout function
function logout() {
    localStorage.removeItem('uav_token');
    localStorage.removeItem('token_timestamp');
    M.toast({ html: 'Logged out successfully', classes: 'green' });
    setTimeout(() => {
        window.location.href = '/login';
    }, 1000);
}

// Event handlers
$(document).ready(function() {
    // Check authentication
    if (!getToken()) {
        window.location.href = '/login';
        return;
    }

    // Initialize Materialize components
    if (typeof M !== 'undefined' && M.AutoInit) {
        M.AutoInit();
    }

    // Load initial data
    loadFlights();

    // Select/unselect all flights
    $(document).on('change', '#selectAll', function () {
        const isChecked = this.checked;
        $('.select-flight').prop('checked', isChecked);
        updateSelectAllState();
    });

    // Individual flight selection
    $(document).on('change', '.select-flight', function() {
        updateSelectAllState();
    });

    // Search flights
    $(document).on('submit', '#searchForm', function (e) {
        e.preventDefault();
        searchQuery = {
            name: $('#searchName').val().trim(),
            date: $('#searchDate').val()
        };
        currentPage = 1; // Reset to first page
        loadFlights(1);
    });

    // Clear search - only if element exists
    $(document).on('click', '#clearSearch', function() {
        $('#searchName').val('');
        $('#searchDate').val('');
        searchQuery = {};
        currentPage = 1;
        loadFlights(1);
    });

    // Bind bulk action buttons
    $(document).on('click', '#bulkDeleteBtn', bulkDelete);
    $(document).on('click', '#bulkExportBtn', bulkExport);
});