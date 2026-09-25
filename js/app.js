// Backend API Configuration (Vercel <-> Render Integration)
function getBackendBaseUrl() {
    const stored = localStorage.getItem('healthpulse_backend_url');
    if (stored) return stored.replace(/\/+$/, '');

    // If running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.port === '8080' ? '' : 'http://localhost:8080';
    }

    // Default Render backend (User can change anytime via the header button)
    return 'https://YOUR-BACKEND.onrender.com';
}

function promptBackendUrl() {
    const current = localStorage.getItem('healthpulse_backend_url') || (window.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://YOUR-BACKEND.onrender.com');
    const newUrl = prompt('Enter your Render Backend URL (e.g. https://my-backend.onrender.com):', current);
    if (newUrl !== null && newUrl.trim() !== '') {
        const cleaned = newUrl.trim().replace(/\/+$/, '');
        localStorage.setItem('healthpulse_backend_url', cleaned);
        showToast('Backend URL updated! Connecting...', 'success');
        setTimeout(() => window.location.reload(), 700);
    }
}

const API_BASE = `${getBackendBaseUrl()}/patient-doctor`;

// App State
let doctorsList = [];
let patientsList = [];

// LocalStorage keys for notifications and doctor availability responses
const NOTIFICATIONS_STORAGE_KEY = 'healthpulse_doctor_notifications';
const RESPONSES_STORAGE_KEY = 'healthpulse_doctor_responses';

// Disease to Speciality Mapping Knowledge Base
const DISEASE_SPECIALITY_MAP = [
    {
        speciality: 'Cardiology',
        keywords: ['heart', 'chest pain', 'cardio', 'blood pressure', 'bp', 'attack', 'palpitation', 'breathless', 'cardiac', 'pulse']
    },
    {
        speciality: 'Dermatology',
        keywords: ['skin', 'rash', 'allergy', 'itching', 'acne', 'pimple', 'eczema', 'derma', 'hair fall', 'scalp', 'infection']
    },
    {
        speciality: 'Orthopedics',
        keywords: ['bone', 'joint', 'fracture', 'knee', 'back pain', 'spine', 'arthritis', 'muscle', 'sprain', 'ortho', 'swelling']
    },
    {
        speciality: 'Dentistry',
        keywords: ['tooth', 'teeth', 'dental', 'cavity', 'gum', 'dentist', 'root canal', 'toothache']
    },
    {
        speciality: 'Ophthalmology',
        keywords: ['eye', 'vision', 'sight', 'cataract', 'blur', 'retina', 'spectacles', 'red eye']
    },
    {
        speciality: 'Neurology',
        keywords: ['brain', 'headache', 'migraine', 'nerve', 'seizure', 'paralysis', 'dizziness']
    },
    {
        speciality: 'Pediatrics',
        keywords: ['child', 'baby', 'kid', 'infant', 'pediatric', 'vaccination']
    },
    {
        speciality: 'ENT',
        keywords: ['ear', 'nose', 'throat', 'sinus', 'tonsil', 'hearing', 'cold']
    },
    {
        speciality: 'Gastroenterology',
        keywords: ['stomach', 'digest', 'acidity', 'gas', 'constipation', 'vomit', 'liver', 'ulcer', 'abdomen']
    },
    {
        speciality: 'General Physician',
        keywords: ['fever', 'cough', 'flu', 'weakness', 'body ache', 'viral', 'fatigue', 'infection']
    }
];

// DOM Elements
const doctorsTableBody = document.getElementById('doctorsTableBody');
const patientsTableBody = document.getElementById('patientsTableBody');
const doctorSelect = document.getElementById('doctorSelect');
const totalDoctorsEl = document.getElementById('totalDoctors');
const totalPatientsEl = document.getElementById('totalPatients');
const toastContainer = document.getElementById('toastContainer');
const headerBellBadge = document.getElementById('headerBellBadge');

// Disease & Location Recommendation Elements
const diseaseSelect = document.getElementById('diseaseSelect');
const customDiseaseInput = document.getElementById('customDiseaseInput');
const otherDiseaseContainer = document.getElementById('otherDiseaseContainer');
const diseaseScrollList = document.getElementById('diseaseScrollList');
const patientCityInput = document.getElementById('patientCity');
const recommendedDoctorsBox = document.getElementById('recommendedDoctorsBox');
const recList = document.getElementById('recList');

// Search Elements
const searchDoctorsInput = document.getElementById('searchDoctors');
const searchPatientsInput = document.getElementById('searchPatients');

// Modals
const detailModal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');
const doctorAppointmentsModal = document.getElementById('doctorAppointmentsModal');
const docAppModalTitle = document.getElementById('docAppModalTitle');
const docAppModalBody = document.getElementById('docAppModalBody');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    initDiseaseRecommendation();
    loadAllData();

    if (searchDoctorsInput) {
        searchDoctorsInput.addEventListener('input', (e) => {
            filterDoctors(e.target.value);
        });
    }

    if (searchPatientsInput) {
        searchPatientsInput.addEventListener('input', (e) => {
            filterPatients(e.target.value);
        });
    }

    updateNotificationBadges();
});

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetPanel = document.getElementById(tab.dataset.target);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

// Load Data
async function loadAllData() {
    await Promise.all([fetchDoctors(), fetchPatients()]);
    updateStats();
    updateNotificationBadges();
}

// ----------------- DISEASE TO DOCTOR RECOMMENDATION (NEAREST FIRST) -----------------
function initDiseaseRecommendation() {
    if (diseaseSelect) {
        diseaseSelect.addEventListener('change', () => {
            handleDiseaseSelect(diseaseSelect.value);
        });
    }

    if (customDiseaseInput) {
        customDiseaseInput.addEventListener('input', () => {
            recommendDoctorsForDisease(customDiseaseInput.value);
        });
    }

    if (patientCityInput) {
        patientCityInput.addEventListener('input', () => {
            const currentDisease = getSelectedDisease();
            if (currentDisease && currentDisease.length >= 3) {
                recommendDoctorsForDisease(currentDisease);
            }
        });
    }
}

// Handler for both Dropdown and Scrollable Disease Palette
function handleDiseaseSelect(val) {
    if (!val) {
        if (recommendedDoctorsBox) recommendedDoctorsBox.classList.remove('show');
        if (otherDiseaseContainer) otherDiseaseContainer.style.display = 'none';
        return;
    }

    // Sync dropdown value
    if (diseaseSelect) {
        diseaseSelect.value = val;
    }

    // Highlight clicked chip in scroll list
    if (diseaseScrollList) {
        const chips = diseaseScrollList.querySelectorAll('.disease-chip');
        chips.forEach(chip => {
            const chipText = chip.innerText.toLowerCase();
            const valLower = val.toLowerCase();
            if (val === 'OTHER' && chipText.includes('other')) {
                chip.classList.add('active');
            } else if (val !== 'OTHER' && (chipText.includes(valLower) || valLower.includes(chipText))) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    if (val === 'OTHER') {
        if (otherDiseaseContainer) otherDiseaseContainer.style.display = 'block';
        if (customDiseaseInput) {
            customDiseaseInput.focus();
            if (customDiseaseInput.value.trim().length >= 3) {
                recommendDoctorsForDisease(customDiseaseInput.value.trim());
            } else if (recommendedDoctorsBox) {
                recommendedDoctorsBox.classList.remove('show');
            }
        }
    } else {
        if (otherDiseaseContainer) otherDiseaseContainer.style.display = 'none';
        recommendDoctorsForDisease(val);
    }
}

function getSelectedDisease() {
    if (diseaseSelect && diseaseSelect.value === 'OTHER') {
        return customDiseaseInput ? customDiseaseInput.value.trim() : '';
    }
    return diseaseSelect ? diseaseSelect.value : '';
}

function recommendDoctorsForDisease(query) {
    if (!recommendedDoctorsBox || !recList) return;

    const text = (query || '').toLowerCase().trim();
    if (!text || text.length < 3) {
        recommendedDoctorsBox.classList.remove('show');
        recList.innerHTML = '';
        return;
    }

    const userCity = (patientCityInput ? patientCityInput.value : '').toLowerCase().trim();

    // Identify matching specialities from keywords
    const matchedSpecialities = [];
    DISEASE_SPECIALITY_MAP.forEach(item => {
        const hasMatch = item.keywords.some(kw => text.includes(kw));
        if (hasMatch) {
            matchedSpecialities.push(item.speciality.toLowerCase());
        }
    });

    // Match with registered doctors
    let matchedDoctors = [];
    if (matchedSpecialities.length > 0) {
        matchedDoctors = doctorsList.filter(doc => {
            if (!doc.speciality) return false;
            const docSpec = doc.speciality.toLowerCase();
            return matchedSpecialities.some(spec => docSpec.includes(spec) || spec.includes(docSpec));
        });
    }

    // Fallback: If no specialist found or keyword didn't match, check General Physicians or all doctors
    if (matchedDoctors.length === 0) {
        const generalDocs = doctorsList.filter(doc => 
            doc.speciality && (doc.speciality.toLowerCase().includes('general') || doc.speciality.toLowerCase().includes('physician'))
        );

        if (generalDocs.length > 0) {
            matchedDoctors = generalDocs;
        }
    }

    if (matchedDoctors.length === 0) {
        recList.innerHTML = `
            <div style="font-size:0.8rem; color:#b45309; padding:0.25rem 0;">
                <i class="fa-solid fa-triangle-exclamation"></i> 
                No registered doctor specifically found for "<em>${escapeHtml(query)}</em>". 
                You can choose any available doctor from the dropdown below.
            </div>
        `;
        recommendedDoctorsBox.classList.add('show');
        return;
    }

    // Sort: Nearest Doctors (Same City) FIRST, then other cities
    const nearestDoctors = [];
    const otherDoctors = [];

    matchedDoctors.forEach(doc => {
        const docCity = (doc.city || '').toLowerCase().trim();
        if (userCity && (docCity === userCity || docCity.includes(userCity) || userCity.includes(docCity))) {
            nearestDoctors.push({ ...doc, isNearest: true });
        } else {
            otherDoctors.push({ ...doc, isNearest: false });
        }
    });

    const sortedDoctors = [...nearestDoctors, ...otherDoctors];
    const currentSelectedDid = doctorSelect ? doctorSelect.value : '';

    let headerTip = '';
    if (nearestDoctors.length > 0) {
        headerTip = `<div style="font-size:0.75rem; color:#15803d; font-weight:600; margin-bottom:0.4rem;">
            <i class="fa-solid fa-location-crosshairs"></i> ${nearestDoctors.length} Nearest doctor(s) found in your city (${escapeHtml(patientCityInput.value.trim())}):
        </div>`;
    } else if (userCity) {
        headerTip = `<div style="font-size:0.75rem; color:#64748b; margin-bottom:0.4rem;">
            <i class="fa-solid fa-circle-info"></i> No matching specialist directly in "${escapeHtml(patientCityInput.value.trim())}". Showing available specialists from other cities:
        </div>`;
    }

    recList.innerHTML = headerTip + sortedDoctors.map(doc => {
        const isSelected = String(doc.did) === String(currentSelectedDid);
        const locationBadge = doc.isNearest 
            ? `<span class="badge-nearest"><i class="fa-solid fa-location-dot"></i> Nearest (${escapeHtml(doc.city)})</span>`
            : `<span class="badge-other-city"><i class="fa-solid fa-building"></i> ${escapeHtml(doc.city || 'City')}</span>`;

        return `
            <div class="doc-rec-card ${isSelected ? 'selected' : ''}" style="${doc.isNearest ? 'border: 1.5px solid #22c55e; background:#f0fdf4;' : ''}">
                <div class="doc-rec-info">
                    <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                        <strong>Dr. ${escapeHtml(doc.name)}</strong>
                        ${locationBadge}
                    </div>
                    <span><i class="fa-solid fa-stethoscope"></i> ${escapeHtml(doc.speciality || 'General')}</span>
                </div>
                <button type="button" class="btn-select-doc ${isSelected ? 'selected' : ''}" onclick="selectDoctorFromRecommendation(${doc.did})">
                    ${isSelected ? '<i class="fa-solid fa-check"></i> Selected' : '<i class="fa-solid fa-calendar-plus"></i> Select Doctor'}
                </button>
            </div>
        `;
    }).join('');

    recommendedDoctorsBox.classList.add('show');
}

function selectDoctorFromRecommendation(did) {
    if (doctorSelect) {
        doctorSelect.value = did;
    }

    // Highlight selected button
    const buttons = document.querySelectorAll('.btn-select-doc');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        btn.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Select Doctor';
    });

    const targetDoc = doctorsList.find(d => d.did === did);
    if (targetDoc) {
        showToast(`Selected Dr. ${targetDoc.name} (${targetDoc.city || ''}) for your appointment!`, 'success');
    }

    // Re-render recommendations to reflect selection
    if (patientSymptomInput) {
        recommendDoctorsForDisease(patientSymptomInput.value);
    }
}

// ----------------- DOCTOR AVAILABILITY RESPONSES & NOTIFICATIONS -----------------
function getStoredNotifications() {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveStoredNotifications(notifs) {
    try {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
    } catch (e) {
        console.error(e);
    }
}

function getDoctorResponses() {
    try {
        const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveDoctorResponse(patientId, respObj) {
    try {
        const responses = getDoctorResponses();
        responses[patientId] = respObj;
        localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(responses));
    } catch (e) {
        console.error(e);
    }
}

function notifyDoctorOfAppointment(doctor, patient, createdPid) {
    const notifs = getStoredNotifications();
    const newNotif = {
        id: Date.now(),
        pid: createdPid,
        doctorId: doctor.did,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phoneNumber,
        patientCity: patient.city,
        symptom: patient.symptom,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString(),
        isRead: false
    };

    notifs.unshift(newNotif);
    saveStoredNotifications(notifs);
    updateNotificationBadges();

    // Trigger high-priority notification toast
    showToast(`🔔 Doctor Alert: Appointment booked with Dr. ${doctor.name} for Patient ${patient.name}!`, 'success');
}

function updateNotificationBadges() {
    const notifs = getStoredNotifications();
    const unreadCount = notifs.filter(n => !n.isRead).length;

    if (headerBellBadge) {
        if (unreadCount > 0) {
            headerBellBadge.textContent = unreadCount;
            headerBellBadge.style.display = 'flex';
        } else {
            headerBellBadge.style.display = 'none';
        }
    }
}

function openAllNotifications() {
    const notifs = getStoredNotifications();
    if (!doctorAppointmentsModal || !docAppModalBody) return;

    if (docAppModalTitle) {
        docAppModalTitle.innerHTML = '<i class="fa-solid fa-bell" style="color:var(--primary);"></i> All Doctor Appointments & Notifications';
    }

    if (!notifs || notifs.length === 0) {
        docAppModalBody.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-bell-slash"></i>
                <p>No appointment alerts yet. When a patient registers with a doctor, notifications appear here!</p>
            </div>
        `;
    } else {
        const responses = getDoctorResponses();
        docAppModalBody.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <span style="font-size:0.85rem; color:#64748b;">Showing recent appointment alerts</span>
                <button class="btn btn-info-outline" style="font-size:0.75rem; padding:0.25rem 0.6rem;" onclick="markAllNotificationsAsRead()">
                    <i class="fa-solid fa-check-double"></i> Mark all read
                </button>
            </div>
            ${notifs.map(n => {
                const currentResp = n.pid ? responses[n.pid] : null;
                const statusBadge = currentResp 
                    ? `<span class="status-pill ${currentResp.status === 'Available' ? 'available' : 'unavailable'}">${escapeHtml(currentResp.message)}</span>`
                    : `<span class="status-pill pending"><i class="fa-regular fa-clock"></i> Awaiting Doctor Reply</span>`;

                return `
                    <div class="app-item-card" style="${!n.isRead ? 'border-left: 4px solid #10b981; background: #f0fdf4;' : ''}">
                        <div class="app-item-header">
                            <strong><i class="fa-solid fa-calendar-check" style="color:#059669;"></i> Dr. ${escapeHtml(n.doctorName)}</strong>
                            <span>${escapeHtml(n.date)} at ${escapeHtml(n.time)}</span>
                        </div>
                        <div class="app-item-body">
                            <div><strong>Patient:</strong> ${escapeHtml(n.patientName)} (${escapeHtml(n.patientCity || 'City')})</div>
                            <div><strong>Disease / Symptom:</strong> <span style="color:#b45309; font-weight:600;">${escapeHtml(n.symptom || 'Not specified')}</span></div>
                            <div><strong>Contact:</strong> ${escapeHtml(n.patientPhone || '-')}</div>
                            <div style="margin-top:0.4rem; display:flex; align-items:center; gap:0.4rem;">
                                <strong>Status:</strong> ${statusBadge}
                            </div>
                        </div>

                        ${n.pid ? renderDoctorReplyBox(n.pid, n.doctorName, currentResp) : ''}
                    </div>
                `;
            }).join('')}
        `;
    }

    doctorAppointmentsModal.classList.add('show');
}

function openDoctorAppointments(did, docName) {
    if (!doctorAppointmentsModal || !docAppModalBody) return;

    if (docAppModalTitle) {
        docAppModalTitle.innerHTML = `<i class="fa-solid fa-user-doctor" style="color:var(--primary);"></i> Appointments for Dr. ${escapeHtml(docName)}`;
    }

    // Get patients assigned to this doctor from backend live state
    const assignedPatients = patientsList.filter(p => p.doctor && p.doctor.did === did);
    const responses = getDoctorResponses();

    if (assignedPatients.length === 0) {
        docAppModalBody.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-calendar-xmark"></i>
                <p>No appointments booked with Dr. ${escapeHtml(docName)} yet.</p>
            </div>
        `;
    } else {
        docAppModalBody.innerHTML = `
            <div style="margin-bottom:0.75rem; font-size:0.85rem; color:#475569; font-weight:600;">
                <i class="fa-solid fa-check-circle" style="color:#10b981;"></i> Total Assigned Patients: ${assignedPatients.length}
            </div>
            ${assignedPatients.map(p => {
                const currentResp = responses[p.pid];
                const statusBadge = currentResp 
                    ? `<span class="status-pill ${currentResp.status === 'Available' ? 'available' : 'unavailable'}">${escapeHtml(currentResp.message)}</span>`
                    : `<span class="status-pill pending"><i class="fa-regular fa-clock"></i> Awaiting Doctor Reply</span>`;

                return `
                    <div class="app-item-card">
                        <div class="app-item-header">
                            <strong><i class="fa-solid fa-hospital-user" style="color:var(--primary);"></i> ${escapeHtml(p.name)}</strong>
                            <span class="badge" style="background:#dbeafe; color:#1e40af;">Patient #${p.pid}</span>
                        </div>
                        <div class="app-item-body">
                            <div><strong>Health Issue / Disease:</strong> <span style="color:#b45309; font-weight:600;">${escapeHtml(p.symptom || 'General')}</span></div>
                            <div><strong>Location:</strong> ${escapeHtml(p.city || '-')}</div>
                            <div><strong>Phone:</strong> ${escapeHtml(p.phoneNumber || '-')}</div>
                            <div style="margin-top:0.4rem; display:flex; align-items:center; gap:0.4rem;">
                                <strong>Status:</strong> ${statusBadge}
                            </div>
                        </div>

                        ${renderDoctorReplyBox(p.pid, docName, currentResp)}
                    </div>
                `;
            }).join('')}
        `;
    }

    doctorAppointmentsModal.classList.add('show');
}

function renderDoctorReplyBox(patientId, doctorName, currentResp) {
    const defaultMsg = currentResp ? currentResp.message : '';
    const defaultStatus = currentResp ? currentResp.status : 'Available';

    return `
        <div class="doc-reply-box">
            <div class="doc-reply-title">
                <i class="fa-solid fa-reply"></i> Send Availability & Time Slot to Patient:
            </div>
            <div style="display:flex; gap:0.5rem; margin-bottom:0.4rem; flex-wrap:wrap;">
                <select id="statusSelect_${patientId}" class="form-control" style="font-size:0.8rem; padding:0.4rem 0.5rem; width:140px;">
                    <option value="Available" ${defaultStatus === 'Available' ? 'selected' : ''}>🟢 Available</option>
                    <option value="Unavailable" ${defaultStatus === 'Unavailable' ? 'selected' : ''}>🔴 Not Available</option>
                </select>
                <input type="text" id="slotMsg_${patientId}" class="form-control" style="font-size:0.8rem; padding:0.4rem 0.6rem; flex:1;" placeholder="e.g. Available Today at 5:00 PM, Room 102" value="${escapeHtml(defaultMsg)}">
            </div>
            <div class="reply-chips">
                <span class="reply-chip" onclick="setQuickSlot(${patientId}, 'Available Today at 5:00 PM (Room 102)', 'Available')">🕒 Today 5:00 PM</span>
                <span class="reply-chip" onclick="setQuickSlot(${patientId}, 'Available Tomorrow at 11:00 AM', 'Available')">🕒 Tomorrow 11:00 AM</span>
                <span class="reply-chip" onclick="setQuickSlot(${patientId}, 'Available on Monday between 2:00-6:00 PM', 'Available')">🕒 Monday 2-6 PM</span>
                <span class="reply-chip" onclick="setQuickSlot(${patientId}, 'Doctor on leave today. Please visit tomorrow.', 'Unavailable')">❌ Not Available Today</span>
            </div>
            <button type="button" class="btn-send-reply" onclick="submitDoctorReply(${patientId}, '${escapeJs(doctorName)}')">
                <i class="fa-regular fa-paper-plane"></i> Send Reply to Patient
            </button>
        </div>
    `;
}

function setQuickSlot(patientId, text, status) {
    const input = document.getElementById(`slotMsg_${patientId}`);
    const select = document.getElementById(`statusSelect_${patientId}`);
    if (input) input.value = text;
    if (select && status) select.value = status;
}

function submitDoctorReply(patientId, doctorName) {
    const input = document.getElementById(`slotMsg_${patientId}`);
    const select = document.getElementById(`statusSelect_${patientId}`);

    const status = select ? select.value : 'Available';
    const message = (input && input.value.trim()) ? input.value.trim() : (status === 'Available' ? 'Doctor is available for consultation' : 'Doctor is currently not available');

    const respObj = {
        patientId: patientId,
        doctorName: doctorName,
        status: status,
        message: message,
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString()
    };

    saveDoctorResponse(patientId, respObj);
    showToast(`Reply sent to Patient #${patientId}: "${message}"`, 'success');

    // Re-render views
    renderPatients(patientsList);

    // If modal is open, refresh modal view
    const notifs = getStoredNotifications();
    const isAllModal = docAppModalTitle && docAppModalTitle.innerText.includes('All Doctor Appointments');
    if (isAllModal) {
        openAllNotifications();
    } else {
        const doc = doctorsList.find(d => d.name === doctorName);
        if (doc) {
            openDoctorAppointments(doc.did, doc.name);
        }
    }
}

function markAllNotificationsAsRead() {
    const notifs = getStoredNotifications();
    notifs.forEach(n => n.isRead = true);
    saveStoredNotifications(notifs);
    updateNotificationBadges();
    openAllNotifications();
}

function closeDoctorAppointmentsModal() {
    if (doctorAppointmentsModal) doctorAppointmentsModal.classList.remove('show');
}

// ----------------- DOCTOR API -----------------
async function fetchDoctors() {
    try {
        const response = await fetch(`${API_BASE}/doctor`);
        if (response.status === 204) {
            doctorsList = [];
        } else if (response.ok) {
            doctorsList = await response.json();
        } else {
            showToast('Failed to fetch doctors', 'error');
            doctorsList = [];
        }
    } catch (err) {
        console.error(err);
        showToast('Cannot connect to backend server', 'error');
        doctorsList = [];
    }
    renderDoctors(doctorsList);
    populateDoctorSelect(doctorsList);
    updateStats();
}

async function addDoctor(doctorData) {
    try {
        const response = await fetch(`${API_BASE}/doctor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doctorData)
        });

        if (response.status === 201 || response.ok) {
            showToast(`Dr. ${doctorData.name} (${doctorData.speciality || 'General'}) added successfully!`, 'success');
            await fetchDoctors();
            return true;
        } else {
            showToast('Error adding doctor', 'error');
            return false;
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while saving doctor', 'error');
        return false;
    }
}

async function deleteDoctor(did, doctorName) {
    if (!confirm(`Are you sure you want to delete Dr. ${doctorName}?`)) return;

    try {
        const response = await fetch(`${API_BASE}/doctor/${did}`, {
            method: 'DELETE'
        });

        if (response.status === 204 || response.ok) {
            showToast('Doctor deleted successfully', 'success');
            await loadAllData();
        } else {
            showToast('Doctor could not be deleted (might have linked patients)', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error deleting doctor', 'error');
    }
}

// ----------------- PATIENT API -----------------
async function fetchPatients() {
    try {
        const response = await fetch(`${API_BASE}/patient`);
        if (response.status === 204) {
            patientsList = [];
        } else if (response.ok) {
            patientsList = await response.json();
        } else {
            showToast('Failed to fetch patients', 'error');
            patientsList = [];
        }
    } catch (err) {
        console.error(err);
        patientsList = [];
    }
    renderPatients(patientsList);
    renderDoctors(doctorsList); // Refresh appointment counters on doctor table
    updateStats();
}

async function addPatient(patientData, assignedDoctorObj) {
    try {
        const response = await fetch(`${API_BASE}/patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData)
        });

        if (response.status === 201 || response.ok) {
            const createdPatient = await response.json();
            showToast(`Patient ${patientData.name} registered successfully!`, 'success');

            // Send notification to doctor if assigned
            if (assignedDoctorObj) {
                notifyDoctorOfAppointment(assignedDoctorObj, patientData, createdPatient.pid);
            }

            await fetchPatients();
            return true;
        } else {
            showToast('Error registering patient', 'error');
            return false;
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while saving patient', 'error');
        return false;
    }
}

async function deletePatient(pid, patientName) {
    if (!confirm(`Are you sure you want to delete patient ${patientName}?`)) return;

    try {
        const response = await fetch(`${API_BASE}/patient/${pid}`, {
            method: 'DELETE'
        });

        if (response.status === 204 || response.ok) {
            showToast('Patient deleted successfully', 'success');
            await fetchPatients();
        } else {
            showToast('Failed to delete patient', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error deleting patient', 'error');
    }
}

async function viewPatientDetails(pid) {
    try {
        const response = await fetch(`${API_BASE}/patient/with-doctor/${pid}`);
        if (response.ok) {
            const data = await response.json();
            displayPatientModal(data);
        } else {
            showToast('Could not load patient details', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error fetching patient details', 'error');
    }
}

// ----------------- RENDER FUNCTIONS -----------------
function renderDoctors(doctors) {
    if (!doctorsTableBody) return;

    if (!doctors || doctors.length === 0) {
        doctorsTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa-solid fa-user-doctor"></i>
                        <p>No doctors registered yet. Add one using the form!</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    doctorsTableBody.innerHTML = doctors.map(doc => {
        // Calculate how many patients are assigned to this doctor
        const assignedPatients = patientsList.filter(p => p.doctor && p.doctor.did === doc.did);
        const count = assignedPatients.length;

        return `
            <tr>
                <td><strong>#${doc.did}</strong></td>
                <td>
                    <strong>Dr. ${escapeHtml(doc.name)}</strong>
                </td>
                <td>
                    <span class="badge badge-speciality">
                        <i class="fa-solid fa-stethoscope"></i> ${escapeHtml(doc.speciality || 'General')}
                    </span>
                </td>
                <td>${escapeHtml(doc.city || '-')}</td>
                <td>
                    <div><i class="fa-regular fa-envelope"></i> ${escapeHtml(doc.email || '-')}</div>
                    <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                        <i class="fa-solid fa-phone"></i> ${escapeHtml(doc.phoneNumber || '-')}
                    </div>
                </td>
                <td>
                    <button class="btn-app-badge" onclick="openDoctorAppointments(${doc.did}, '${escapeJs(doc.name)}')">
                        <i class="fa-solid fa-bell"></i>
                        <span>Appointments</span>
                        <span class="badge-count">${count}</span>
                    </button>
                </td>
                <td>
                    <button class="btn btn-danger-outline" onclick="deleteDoctor(${doc.did}, '${escapeJs(doc.name)}')">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPatients(patients) {
    if (!patientsTableBody) return;

    if (!patients || patients.length === 0) {
        patientsTableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fa-solid fa-hospital-user"></i>
                        <p>No patients registered yet. Add one using the form!</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const responses = getDoctorResponses();

    patientsTableBody.innerHTML = patients.map(p => {
        const docBadge = p.doctor 
            ? `<span class="badge badge-doctor"><i class="fa-solid fa-user-doctor"></i> Dr. ${escapeHtml(p.doctor.name)}</span>`
            : `<span class="badge badge-none">Unassigned</span>`;

        // Doctor Availability Confirmation Status
        const currentResp = responses[p.pid];
        let confirmationHtml = '';
        if (currentResp) {
            if (currentResp.status === 'Available') {
                confirmationHtml = `<span class="status-pill available" title="${escapeHtml(currentResp.message)}"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(currentResp.message)}</span>`;
            } else {
                confirmationHtml = `<span class="status-pill unavailable" title="${escapeHtml(currentResp.message)}"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(currentResp.message)}</span>`;
            }
        } else if (p.doctor) {
            confirmationHtml = `<span class="status-pill pending"><i class="fa-regular fa-clock"></i> Awaiting Doctor Reply</span>`;
        } else {
            confirmationHtml = `<span class="badge badge-none">No Doctor</span>`;
        }

        return `
            <tr>
                <td><strong>#${p.pid}</strong></td>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>
                    <span style="font-weight:600; color:#b45309; background:#fef3c7; padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                        ${escapeHtml(p.symptom || 'General Checkup')}
                    </span>
                </td>
                <td>${docBadge}</td>
                <td>${confirmationHtml}</td>
                <td>${escapeHtml(p.city || '-')}</td>
                <td>
                    <div><i class="fa-solid fa-phone"></i> ${escapeHtml(p.phoneNumber || '-')}</div>
                </td>
                <td>
                    <div style="display:flex; gap:0.4rem;">
                        <button class="btn btn-info-outline" onclick="viewPatientDetails(${p.pid})">
                            <i class="fa-regular fa-eye"></i> Details
                        </button>
                        <button class="btn btn-danger-outline" onclick="deletePatient(${p.pid}, '${escapeJs(p.name)}')">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function populateDoctorSelect(doctors) {
    if (!doctorSelect) return;
    const currentVal = doctorSelect.value;
    doctorSelect.innerHTML = '<option value="">-- Select Assigned Doctor (Optional) --</option>';
    doctors.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.did;
        option.textContent = `Dr. ${doc.name} (${doc.speciality || 'General'}) - ${doc.city || 'Hospital'}`;
        doctorSelect.appendChild(option);
    });

    if (currentVal) {
        doctorSelect.value = currentVal;
    }
}

function updateStats() {
    if (totalDoctorsEl) totalDoctorsEl.textContent = doctorsList.length;
    if (totalPatientsEl) totalPatientsEl.textContent = patientsList.length;
}

// Filter functions
function filterDoctors(keyword) {
    const q = keyword.toLowerCase().trim();
    const filtered = doctorsList.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.speciality && d.speciality.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q))
    );
    renderDoctors(filtered);
}

function filterPatients(keyword) {
    const q = keyword.toLowerCase().trim();
    const filtered = patientsList.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.symptom && p.symptom.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.doctor && p.doctor.name && p.doctor.name.toLowerCase().includes(q))
    );
    renderPatients(filtered);
}

// ----------------- FORM HANDLERS -----------------
function initForms() {
    const doctorForm = document.getElementById('doctorForm');
    if (doctorForm) {
        doctorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const doctorData = {
                name: document.getElementById('docName').value.trim(),
                speciality: document.getElementById('docSpeciality').value.trim(),
                city: document.getElementById('docCity').value.trim(),
                email: document.getElementById('docEmail').value.trim(),
                phoneNumber: document.getElementById('docPhone').value.trim()
            };

            const success = await addDoctor(doctorData);
            if (success) {
                doctorForm.reset();
            }
        });
    }

    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const diseaseVal = getSelectedDisease();
            if (!diseaseVal) {
                showToast('Please select or specify a Disease / Symptom!', 'error');
                if (diseaseSelect) diseaseSelect.focus();
                return;
            }

            const docIdVal = document.getElementById('doctorSelect').value;
            const assignedDoctorObj = docIdVal ? doctorsList.find(d => String(d.did) === String(docIdVal)) : null;

            const patientData = {
                name: document.getElementById('patientName').value.trim(),
                city: document.getElementById('patientCity').value.trim(),
                email: document.getElementById('patientEmail').value.trim(),
                phoneNumber: document.getElementById('patientPhone').value.trim(),
                symptom: diseaseVal,
                doctor: docIdVal ? { did: parseInt(docIdVal) } : null
            };

            const success = await addPatient(patientData, assignedDoctorObj);
            if (success) {
                patientForm.reset();
                if (diseaseSelect) diseaseSelect.value = '';
                if (customDiseaseInput) customDiseaseInput.value = '';
                if (otherDiseaseContainer) otherDiseaseContainer.style.display = 'none';
                if (diseaseScrollList) {
                    diseaseScrollList.querySelectorAll('.disease-chip').forEach(c => c.classList.remove('active'));
                }
                if (recommendedDoctorsBox) {
                    recommendedDoctorsBox.classList.remove('show');
                }
            }
        });
    }
}

// ----------------- MODAL & TOAST -----------------
function displayPatientModal(dto) {
    if (!detailModal || !modalBody) return;

    let doctorInfoHtml = `
        <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:0.85rem; text-align:center; color:#64748b; margin-top:1rem;">
            No doctor assigned to this patient.
        </div>
    `;

    const responses = getDoctorResponses();
    const currentResp = responses[dto.pid];

    let doctorResponseCard = '';
    if (currentResp) {
        doctorResponseCard = `
            <div style="margin-top:1rem; padding:0.85rem; border-radius:8px; border:1.5px solid ${currentResp.status === 'Available' ? '#86efac; background:#f0fdf4;' : '#fca5a5; background:#fef2f2;'}">
                <h4 style="font-size:0.85rem; color:${currentResp.status === 'Available' ? '#15803d;' : '#991b1b;'}; margin-bottom:0.35rem;">
                    <i class="fa-solid fa-stethoscope"></i> Doctor's Availability Response:
                </h4>
                <div style="font-weight:700; font-size:0.95rem; color:#1e293b;">${escapeHtml(currentResp.message)}</div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">Updated on: ${escapeHtml(currentResp.updatedAt || 'Recently')}</div>
            </div>
        `;
    } else if (dto.doctorDto) {
        doctorResponseCard = `
            <div style="margin-top:1rem; padding:0.75rem; background:#fef3c7; border:1px solid #fde68a; border-radius:8px; font-size:0.85rem; color:#92400e;">
                <i class="fa-regular fa-clock"></i> <strong>Awaiting Doctor Confirmation:</strong> Doctor has been notified and will reply with available time slot.
            </div>
        `;
    }

    if (dto.doctorDto) {
        doctorInfoHtml = `
            <div class="doctor-subcard">
                <h4><i class="fa-solid fa-stethoscope"></i> Consulting Doctor Details</h4>
                <div class="detail-row"><span class="detail-label">Doctor Name:</span><span class="detail-val">Dr. ${escapeHtml(dto.doctorDto.name)}</span></div>
                <div class="detail-row"><span class="detail-label">Speciality:</span><span class="detail-val">${escapeHtml(dto.doctorDto.speciality || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-val">${escapeHtml(dto.doctorDto.email || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-val">${escapeHtml(dto.doctorDto.phoneNumber || '-')}</span></div>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="detail-row"><span class="detail-label">Patient ID:</span><span class="detail-val">#${dto.pid}</span></div>
        <div class="detail-row"><span class="detail-label">Patient Name:</span><span class="detail-val">${escapeHtml(dto.name)}</span></div>
        <div class="detail-row"><span class="detail-label">Symptom / Condition:</span><span class="detail-val" style="color:#b45309;">${escapeHtml(dto.symptom || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">City:</span><span class="detail-val">${escapeHtml(dto.city || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-val">${escapeHtml(dto.email || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Contact Phone:</span><span class="detail-val">${escapeHtml(dto.phoneNumber || '-')}</span></div>
        ${doctorInfoHtml}
        ${doctorResponseCard}
    `;

    detailModal.classList.add('show');
}

function closeModal() {
    if (detailModal) detailModal.classList.remove('show');
}

function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Helpers
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}
