function getToken() {
    return localStorage.getItem('uav_token');
}

let currentPage = 1;
let searchQuery = {};
let flightsCache = [];

async function loadFlights(page = 1) {
    currentPage = page;
    const token = getToken();

    let query = `?page=${page}&limit=10`;
    if (searchQuery.name) query += `&name=${encodeURIComponent(searchQuery.name)}`;
    if (searchQuery.date) query += `&date=${encodeURIComponent(searchQuery.date)}`;

    try {
        const res = await fetch(`/api/flights${query}`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        flightsCache = data.flights;
        renderFlights(data.flights);
        renderPagination(data.pagination);
    } catch (err) {
        console.error(err);
        M.toast({ html: err.message, classes: 'red' });
    }
}

function renderFlights(flights) {
    const tbody = $('#flightsTableBody');
    tbody.empty();
    flights.forEach(f => {
        tbody.append(`
      <tr>
        <td><label><input type="checkbox" class="select-flight" data-id="${f.id}"><span></span></label></td>
        <td>${f.flightName}</td>
        <td>${new Date(f.uploadDate).toLocaleString()}</td>
        <td>${f.totalPoints}</td>
        <td>${(100 - (f.averageError / 10)).toFixed(1)}%</td>
        <td>${f.responseTime} ms</td>
        <td>
          <a class="btn-small teal" href="/flights/${f.id}">View</a>
          <button class="btn-small orange" onclick="editFlight('${f.id}', '${f.flightName}')">Edit</button>
          <button class="btn-small red" onclick="deleteFlight('${f.id}')">Delete</button>
        </td>
      </tr>
    `);
    });
}

function renderPagination(pagination) {
    const ul = $('#pagination');
    ul.empty();
    if (pagination.total <= 1) return;

    if (pagination.hasPrev) {
        ul.append(`<li class="waves-effect"><a href="javascript:loadFlights(${pagination.current - 1})"><i class="material-icons">chevron_left</i></a></li>`);
    }
    for (let i = 1; i <= pagination.total; i++) {
        ul.append(`<li class="${i === pagination.current ? 'active teal' : 'waves-effect'}"><a href="javascript:loadFlights(${i})">${i}</a></li>`);
    }
    if (pagination.hasNext) {
        ul.append(`<li class="waves-effect"><a href="javascript:loadFlights(${pagination.current + 1})"><i class="material-icons">chevron_right</i></a></li>`);
    }
}

// 删除航班
async function deleteFlight(id) {
    if (!confirm('Delete this flight?')) return;
    const token = getToken();
    try {
        const res = await fetch(`/api/flights/${id}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        M.toast({ html: 'Deleted', classes: 'green' });
        loadFlights(currentPage);
    } catch (err) {
        console.error(err);
        M.toast({ html: err.message, classes: 'red' });
    }
}

// 编辑航班
function editFlight(id, currentName) {
    const newName = prompt('New name:', currentName);
    if (!newName || newName === currentName) return;
    const token = getToken();
    fetch(`/api/flights/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ flightName: newName })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.success) throw new Error(data.message);
            M.toast({ html: 'Updated', classes: 'green' });
            loadFlights(currentPage);
        })
        .catch(err => {
            console.error(err);
            M.toast({ html: err.message, classes: 'red' });
        });
}

// 批量删除
async function bulkDelete() {
    const ids = $('.select-flight:checked').map((_, el) => $(el).data('id')).get();
    if (!ids.length) return alert('Select at least one flight');
    if (!confirm('Delete selected flights?')) return;
    for (const id of ids) {
        await deleteFlight(id);
    }
}

// 批量导出 CSV
function bulkExport() {
    const ids = $('.select-flight:checked').map((_, el) => $(el).data('id')).get();
    const rows = flightsCache.filter(f => ids.includes(f.id));
    if (!rows.length) return alert('Select at least one flight');

    let csv = "Name,Date,Points,Accuracy,ResponseTime\n";
    rows.forEach(f => {
        csv += `${f.flightName},${new Date(f.uploadDate).toISOString()},${f.totalPoints},${(100 - (f.averageError / 10)).toFixed(1)},${f.responseTime}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flights.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// 全选/全不选
$('#selectAll').on('change', function () {
    $('.select-flight').prop('checked', this.checked);
});

// 搜索提交
$('#searchForm').on('submit', function (e) {
    e.preventDefault();
    searchQuery = {
        name: $('#searchName').val(),
        date: $('#searchDate').val()
    };
    loadFlights(1);
});

// 批量按钮绑定
$('#bulkDeleteBtn').on('click', bulkDelete);
$('#bulkExportBtn').on('click', bulkExport);

// 初始化加载
$(document).ready(() => {
    loadFlights();
});
