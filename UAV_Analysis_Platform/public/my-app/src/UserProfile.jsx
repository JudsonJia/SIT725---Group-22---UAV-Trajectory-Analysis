import React, { useState, useEffect } from "react";
import "./UserProfile.css";

export default function UserProfile() {
  const [profileImage, setProfileImage] = useState("https://randomuser.me/api/portraits/women/68.jpg");
  const [formData, setFormData] = useState({ username: "", email: "" });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  useEffect(() => {
    fetch("http://localhost:3000/api/profile")
      .then(res => res.json())
      .then(data => {
        setFormData({ username: data.username, email: data.email });
        if (data.profileImage) setProfileImage(data.profileImage);
      })
      .catch(() => console.log("Failed to load profile"));
  }, []);

  // Handle avatar upload via Upload button
  const handleUpload = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = e => {
      const file = e.target.files[0];
      if (file && file.size <= 2 * 1024 * 1024 && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setProfileImage(reader.result);
        reader.readAsDataURL(file);
      } else {
        alert("Please upload an image smaller than 2MB");
      }
    };
    fileInput.click();
  };

  const handleSaveProfile = () => {
    fetch("http://localhost:3000/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, profileImage }),
    })
      .then(res => res.json())
      .then(() => alert("Profile updated successfully"))
      .catch(() => alert("Failed to update profile"));
  };

  const handleChangePassword = () => {
    if (passwords.newPass !== passwords.confirm) {
      alert("New passwords do not match!");
      return;
    }
    fetch("http://localhost:3000/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
    })
      .then(res => res.json())
      .then(() => {
        alert("Password changed successfully");
        setShowPasswordModal(false);
      })
      .catch(() => alert("Failed to change password"));
  };

  return (
    <div className="profile-container">

      {/* Avatar */}
      <div className="avatar-container">
        <img src={profileImage} alt="Profile" className="avatar" />
      </div>

      <div className="button-group">
        <button onClick={handleUpload}>Upload</button>
        <button onClick={() => setProfileImage("https://randomuser.me/api/portraits/women/68.jpg")}>Delete</button>
      </div>

      {/* Profile Form */}
      <div className="profile-card">
        <div className="input-group">
          <label>Username</label>
          <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
        </div>
        <div className="input-group">
          <label>Email</label>
          <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
        </div>
        <button className="save-btn" onClick={handleSaveProfile}>Save Profile</button>
        <button className="password-btn" onClick={() => setShowPasswordModal(true)}>Change Password</button>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Change Password</h3>
            <input type="password" placeholder="Current Password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
            <input type="password" placeholder="New Password" value={passwords.newPass} onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} />
            <input type="password" placeholder="Confirm Password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
            <div className="modal-buttons">
              <button onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button onClick={handleChangePassword}>Update</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
