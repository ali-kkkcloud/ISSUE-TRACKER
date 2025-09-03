// Global variables
let allIssuesData = [];
let filteredIssuesData = [];
let charts = {};
let currentFilters = {
    search: '',
    city: 'All',
    client: 'All',
    assignedTo: 'All',
    status: 'All',
    priority: 'All',
    vehicle: 'All',
    month: 'All'
};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    loadInitialData();
    setupTabNavigation();
    setupHamburgerMenu();
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Filter dropdowns
    const filters = ['cityFilter', 'clientFilter', 'assigneeFilter', 'statusFilter', 'priorityFilter'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', handleFilterChange);
        }
    });

    // Buttons
    const resetBtn = document.getElementById('resetFilters');
    const exportBtn = document.getElementById('exportBtn');
    
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    if (exportBtn) exportBtn.addEventListener('click', exportData);
}

// Setup tab navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Load appropriate data based on tab
            if (targetTab === 'unresolved-issues') {
                loadUnresolvedIssues();
            }
        });
    });
}

// Setup hamburger menu
function setupHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const tabNavigation = document.getElementById('tabNavigation');
    
    if (hamburger && tabNavigation) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            tabNavigation.classList.toggle('mobile-hidden');
        });
    }
}

// Load initial data
function loadInitialData() {
    showLoading(true);
    
    // Call Google Apps Script function
    google.script.run
        .withSuccessHandler(handleDataSuccess)
        .withFailureHandler(handleDataError)
        .getAllIssuesData();
}

function handleDataSuccess(result) {
    console.log('Data received:', result);
    
    if (result.success) {
        allIssuesData = result.data || [];
        filteredIssuesData = [...allIssuesData];
        
        updateSummaryCards(result.summary);
        populateFilterOptions();
        updateChartsAndTable();
        updateLastUpdate();
        
        showLoading(false);
    } else {
        handleDataError(result.message || 'Unknown error occurred');
    }
}

function handleDataError(error) {
    console.error('Error loading data:', error);
    showLoading(false);
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div style="background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 8px; margin: 1rem;">
            <strong>Error loading data:</strong> ${error}
            <br><br>
            <button onclick="loadInitialData()" class="btn-primary" style="margin-top: 0.5rem;">
                <i class="fas fa-refresh"></i> Retry
            </button>
        </div>
    `;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.prepend(errorDiv);
    }
}

// Show/hide loading overlay
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// Update summary cards
function updateSummaryCards(summary) {
    if (!summary) return;
    
    const elements = {
        totalIssues: summary.totalIssues || 0,
        openIssues: summary.openCount || 0,
        closedIssues: summary.closedCount || 0,
        onHoldIssues: summary.onHoldCount || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            animateNumber(element, value);
        }
    });
}

function animateNumber(element, finalValue) {
    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(startValue + (finalValue - startValue) * progress);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Populate filter dropdown options
function populateFilterOptions() {
    if (!allIssuesData.length) return;
    
    // Get unique values for each filter
    const cities = [...new Set(allIssuesData.map(issue => issue.City).filter(Boolean))].sort();
    const clients = [...new Set(allIssuesData.map(issue => issue.Client).filter(Boolean))].sort();
    const assignees = [...new Set(allIssuesData.map(issue => issue['Assigned To']).filter(Boolean))].sort();
    const priorities = [...new Set(allIssuesData.map(issue => issue['Priority (High/Med/Low)']).filter(Boolean))].sort();
    
    // Populate dropdowns
    populateDropdown('cityFilter', cities);
    populateDropdown('clientFilter', clients);
    populateDropdown('assigneeFilter', assignees);
    populateDropdown('priorityFilter', priorities);
}

function populateDropdown(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Keep the "All" option and add new options
    const allOption = select.querySelector('option[value="All"]');
    select.innerHTML = '';
    if (allOption) select.appendChild(allOption);
    
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Handle search
function handleSearch(event) {
    currentFilters.search = event.target.value;
    applyFilters();
}

// Handle filter changes
function handleFilterChange(event) {
    const filterId = event.target.id;
    const filterMap = {
        'cityFilter': 'city',
        'clientFilter': 'client',
        'assigneeFilter': 'assignedTo',
        'statusFilter': 'status',
        'priorityFilter': 'priority'
    };
    
    const filterKey = filterMap[filterId];
    if (filterKey) {
        currentFilters[filterKey] = event.target.value;
        applyFilters();
    }
}

// Apply filters
function applyFilters() {
    filteredIssuesData = allIssuesData.filter(issue => {
        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            const searchableText = Object.values(issue).join(' ').toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        // Dropdown filters
        if (currentFilters.city !== 'All' && issue.City !== currentFilters.city) return false;
        if (currentFilters.client !== 'All' && issue.Client !== currentFilters.client) return false;
        if (currentFilters.assignedTo !== 'All' && issue['Assigned To'] !== currentFilters.assignedTo) return false;
        if (currentFilters.priority !== 'All' && issue['Priority (High/Med/Low)'] !== currentFilters.priority) return false;
        
        // Status filter
        if (currentFilters.status !== 'All') {
            const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
            const followUpDate = (issue['Next Follow Up Date'] || '').toString().trim();
            
            switch (currentFilters.status) {
                case 'Open':
                    if (!((resolved === 'no' || resolved === 'n' || resolved === '') && followUpDate === '')) return false;
                    break;
                case 'Closed':
                    if (!(resolved === 'yes' || resolved === 'y')) return false;
                    break;
                case 'On Hold':
                    if (!((resolved === 'no' || resolved === 'n') && followUpDate !== '')) return false;
                    break;
            }
        }
        
        return true;
    });
    
    updateChartsAndTable();
}

// Reset filters
function resetFilters() {
    currentFilters = {
        search: '',
        city: 'All',
        client: 'All',
        assignedTo: 'All',
        status: 'All',
        priority: 'All'
    };
    
    // Reset form elements
    document.getElementById('searchInput').value = '';
    document.getElementById('cityFilter').value = 'All';
    document.getElementById('clientFilter').value = 'All';
    document.getElementById('assigneeFilter').value = 'All';
    document.getElementById('statusFilter').value = 'All';
    document.getElementById('priorityFilter').value = 'All';
    
    filteredIssuesData = [...allIssuesData];
    updateChartsAndTable();
}

// Update charts and table
function updateChartsAndTable() {
    updateTable();
    updateCharts();
}

// Update table
function updateTable() {
    const tableBody = document.getElementById('tableBody');
    const tableInfo = document.getElementById('tableInfo');
    
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Add filtered data rows
    filteredIssuesData.forEach(issue => {
        const row = createTableRow(issue);
        tableBody.appendChild(row);
    });
    
    // Update table info
    if (tableInfo) {
        tableInfo.textContent = `Showing ${filteredIssuesData.length} of ${allIssuesData.length} issues`;
    }
}

function createTableRow(issue) {
    const row = document.createElement('tr');
    
    const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
    const followUpDate = (issue['Next Follow Up Date'] || '').toString().trim();
    
    let statusClass = 'status-open';
    let statusText = 'Open';
    
    if (resolved === 'yes' || resolved === 'y') {
        statusClass = 'status-closed';
        statusText = 'Closed';
    } else if ((resolved === 'no' || resolved === 'n') && followUpDate !== '') {
        statusClass = 'status-hold';
        statusText = 'On Hold';
    }
    
    const priority = issue['Priority (High/Med/Low)'] || '';
    let priorityClass = '';
    if (priority.toLowerCase().includes('high')) priorityClass = 'priority-high';
    else if (priority.toLowerCase().includes('med')) priorityClass = 'priority-medium';
    else if (priority.toLowerCase().includes('low')) priorityClass = 'priority-low';
    
    row.innerHTML = `
        <td>${issue['Issue ID'] || ''}</td>
        <td><strong>${issue.Client || ''}</strong></td>
        <td>${issue.City || ''}</td>
        <td>${issue.Issue || ''}</td>
        <td>${issue['Vehicle Number'] || ''}</td>
        <td><span class="${priorityClass}">${priority}</span></td>
        <td>${issue['Assigned To'] || ''}</td>
        <td>${formatDate(issue['Timestamp Issues Raised'])}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${formatDate(issue['Next Follow Up Date'])}</td>
    `;
    
    return row;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

// Update all charts
function updateCharts() {
    updateStatusChart();
    updatePriorityChart();
    updateCityChart();
    updateMonthlyChart();
    updateAssigneeIssueTypesChart();
    updateOldestIssuesDisplay();
}

// Status Distribution Chart
function updateStatusChart() {
    const ctx = document.getElementById('statusChart');
    const dataDisplay = document.getElementById('statusData');
    if (!ctx || !filteredIssuesData.length) return;
    
    let openCount = 0, closedCount = 0, holdCount = 0;
    
    filteredIssuesData.forEach(issue => {
        const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
        const followUpDate = (issue['Next Follow Up Date'] || '').toString().trim();
        
        if (resolved === 'yes' || resolved === 'y') {
            closedCount++;
        } else if ((resolved === 'no' || resolved === 'n') && followUpDate !== '') {
            holdCount++;
        } else {
            openCount++;
        }
    });
    
    const data = {
        labels: ['Open', 'Closed', 'On Hold'],
        datasets: [{
            data: [openCount, closedCount, holdCount],
            backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };
    
    if (charts.status) charts.status.destroy();
    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
    
    // Display data directly
    if (dataDisplay) {
        dataDisplay.innerHTML = `
            <div class="data-item">
                <span class="data-label">Open Issues</span>
                <span class="data-value">${openCount}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Closed Issues</span>
                <span class="data-value">${closedCount}</span>
            </div>
            <div class="data-item">
                <span class="data-label">On Hold Issues</span>
                <span class="data-value">${holdCount}</span>
            </div>
        `;
    }
}

// Priority Distribution Chart
function updatePriorityChart() {
    const ctx = document.getElementById('priorityChart');
    const dataDisplay = document.getElementById('priorityData');
    if (!ctx || !filteredIssuesData.length) return;
    
    const priorityCount = {};
    
    filteredIssuesData.forEach(issue => {
        const priority = issue['Priority (High/Med/Low)'] || 'Unknown';
        priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    });
    
    const labels = Object.keys(priorityCount);
    const values = Object.values(priorityCount);
    const colors = labels.map(label => {
        if (label.toLowerCase().includes('high')) return '#ef4444';
        if (label.toLowerCase().includes('med')) return '#f59e0b';
        if (label.toLowerCase().includes('low')) return '#10b981';
        return '#6b7280';
    });
    
    if (charts.priority) charts.priority.destroy();
    charts.priority = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: colors.map(color => color + '80')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Display data directly
    if (dataDisplay) {
        dataDisplay.innerHTML = labels.map((label, index) => 
            `<div class="data-item">
                <span class="data-label">${label}</span>
                <span class="data-value">${values[index]}</span>
            </div>`
        ).join('');
    }
}

// City-wise Chart
function updateCityChart() {
    const ctx = document.getElementById('cityChart');
    const dataDisplay = document.getElementById('cityData');
    if (!ctx || !filteredIssuesData.length) return;
    
    const cityCount = {};
    
    filteredIssuesData.forEach(issue => {
        const city = issue.City || 'Unknown';
        cityCount[city] = (cityCount[city] || 0) + 1;
    });
    
    const labels = Object.keys(cityCount);
    const values = Object.values(cityCount);
    
    if (charts.city) charts.city.destroy();
    charts.city = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: '#2563eb',
                borderWidth: 1,
                borderColor: '#1e40af'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Display data directly
    if (dataDisplay) {
        dataDisplay.innerHTML = labels.map((label, index) => 
            `<div class="data-item">
                <span class="data-label">${label}</span>
                <span class="data-value">${values[index]}</span>
            </div>`
        ).join('');
    }
}

// Monthly Trends Chart
function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    const dataDisplay = document.getElementById('monthlyData');
    if (!ctx || !filteredIssuesData.length) return;
    
    const monthlyData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    filteredIssuesData.forEach(issue => {
        const timestampStr = (issue['Timestamp Issues Raised'] || '').toString().trim();
        let month = 'Unknown';
        
        if (timestampStr) {
            const date = new Date(timestampStr);
            if (!isNaN(date.getTime())) {
                month = monthNames[date.getMonth()];
            }
        }
        
        if (!monthlyData[month]) {
            monthlyData[month] = { total: 0, open: 0, closed: 0 };
        }
        monthlyData[month].total++;
        
        const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
        if (resolved === 'yes' || resolved === 'y') {
            monthlyData[month].closed++;
        } else {
            monthlyData[month].open++;
        }
    });
    
    const labels = Object.keys(monthlyData);
    const totalData = labels.map(month => monthlyData[month].total);
    const openData = labels.map(month => monthlyData[month].open);
    const closedData = labels.map(month => monthlyData[month].closed);
    
    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Issues',
                    data: totalData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Open Issues',
                    data: openData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Closed Issues',
                    data: closedData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Display data directly
    if (dataDisplay) {
        dataDisplay.innerHTML = labels.map(month => 
            `<div class="data-item">
                <span class="data-label">${month}</span>
                <span class="data-value">Total: ${monthlyData[month].total}, Open: ${monthlyData[month].open}, Closed: ${monthlyData[month].closed}</span>
            </div>`
        ).join('');
    }
}

// NEW: Assignee Issue Types Chart
function updateAssigneeIssueTypesChart() {
    const ctx = document.getElementById('assigneeIssueTypesChart');
    if (!ctx || !filteredIssuesData.length) return;
    
    const assigneeData = {};
    
    filteredIssuesData.forEach(issue => {
        const assignee = issue['Assigned To'] || 'Unassigned';
        const issueType = issue.Issue || 'Unknown';
        
        if (!assigneeData[assignee]) {
            assigneeData[assignee] = {};
        }
        
        assigneeData[assignee][issueType] = (assigneeData[assignee][issueType] || 0) + 1;
    });
    
    // Create stacked bar chart data
    const assignees = Object.keys(assigneeData);
    const allIssueTypes = [...new Set(filteredIssuesData.map(issue => issue.Issue || 'Unknown'))];
    
    const datasets = allIssueTypes.map((issueType, index) => ({
        label: issueType,
        data: assignees.map(assignee => assigneeData[assignee][issueType] || 0),
        backgroundColor: getColorForIndex(index),
        borderWidth: 1
    }));
    
    if (charts.assigneeIssueTypes) charts.assigneeIssueTypes.destroy();
    charts.assigneeIssueTypes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: assignees,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// NEW: Update Oldest Issues Display
function updateOldestIssuesDisplay() {
    const container = document.getElementById('oldestIssuesContainer');
    if (!container || !filteredIssuesData.length) return;
    
    const assigneeOldestIssues = {};
    
    // Find oldest open issue for each assignee
    filteredIssuesData.forEach(issue => {
        const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
        if (resolved === 'yes' || resolved === 'y') return; // Skip closed issues
        
        const assignee = issue['Assigned To'] || 'Unassigned';
        const timestampStr = (issue['Timestamp Issues Raised'] || '').toString().trim();
        
        if (!timestampStr) return;
        
        const issueDate = new Date(timestampStr);
        if (isNaN(issueDate.getTime())) return;
        
        if (!assigneeOldestIssues[assignee] || issueDate < new Date(assigneeOldestIssues[assignee]['Timestamp Issues Raised'])) {
            assigneeOldestIssues[assignee] = issue;
        }
    });
    
    // Generate HTML for each assignee's oldest issue
    const html = Object.keys(assigneeOldestIssues).map(assignee => {
        const issue = assigneeOldestIssues[assignee];
        const ageInDays = Math.floor((new Date() - new Date(issue['Timestamp Issues Raised'])) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="oldest-issue-item">
                <div class="issue-assignee">
                    <i class="fas fa-user"></i>
                    ${assignee}
                </div>
                <div class="issue-details">
                    <strong>${issue.Issue || 'No description'}</strong>
                    <br>
                    Issue ID: ${issue['Issue ID'] || 'N/A'} | Client: ${issue.Client || 'N/A'}
                </div>
                <div class="issue-age">
                    <i class="fas fa-clock"></i>
                    ${ageInDays} days old
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html || '<p style="text-align: center; color: #6b7280; padding: 2rem;">No open issues found</p>';
}

// Load Unresolved Issues (20+ days)
function loadUnresolvedIssues() {
    const container = document.getElementById('unresolvedContainer');
    const countElement = document.getElementById('unresolvedCount');
    
    if (!container || !allIssuesData.length) return;
    
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    
    // Filter for unresolved issues older than 20 days
    const unresolvedIssues = allIssuesData.filter(issue => {
        const resolved = (issue['Resolved Y/N'] || '').toString().toLowerCase().trim();
        if (resolved === 'yes' || resolved === 'y') return false; // Skip closed
        
        const timestampStr = (issue['Timestamp Issues Raised'] || '').toString().trim();
        if (!timestampStr) return false;
        
        const issueDate = new Date(timestampStr);
        if (isNaN(issueDate.getTime())) return false;
        
        return issueDate < twentyDaysAgo;
    });
    
    // Update count
    if (countElement) {
        animateNumber(countElement, unresolvedIssues.length);
    }
    
    // Group by assignee
    const groupedIssues = {};
    unresolvedIssues.forEach(issue => {
        const assignee = issue['Assigned To'] || 'Unassigned';
        if (!groupedIssues[assignee]) {
            groupedIssues[assignee] = [];
        }
        groupedIssues[assignee].push(issue);
    });
    
    // Generate HTML
    const html = Object.keys(groupedIssues).map(assignee => {
        const issues = groupedIssues[assignee];
        
        const tableRows = issues.map(issue => {
            const ageInDays = Math.floor((new Date() - new Date(issue['Timestamp Issues Raised'])) / (1000 * 60 * 60 * 24));
            const priority = issue['Priority (High/Med/Low)'] || '';
            let priorityClass = '';
            if (priority.toLowerCase().includes('high')) priorityClass = 'priority-high';
            else if (priority.toLowerCase().includes('med')) priorityClass = 'priority-medium';
            else if (priority.toLowerCase().includes('low')) priorityClass = 'priority-low';
            
            return `
                <tr>
                    <td>${issue['Issue ID'] || ''}</td>
                    <td><strong>${issue.Client || ''}</strong></td>
                    <td>${issue.City || ''}</td>
                    <td>${issue.Issue || ''}</td>
                    <td>${issue['Vehicle Number'] || ''}</td>
                    <td><span class="${priorityClass}">${priority}</span></td>
                    <td>${formatDate(issue['Timestamp Issues Raised'])}</td>
                    <td><strong style="color: #dc2626;">${ageInDays} days</strong></td>
                    <td>${formatDate(issue['Next Follow Up Date'])}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div class="assignee-group">
                <div class="assignee-header">
                    <div class="assignee-name">
                        <i class="fas fa-user"></i>
                        ${assignee}
                    </div>
                    <div class="assignee-count">${issues.length} issues</div>
                </div>
                <div class="assignee-issues">
                    <table class="issues-table">
                        <thead>
                            <tr>
                                <th>Issue ID</th>
                                <th>Client</th>
                                <th>City</th>
                                <th>Issue</th>
                                <th>Vehicle Number</th>
                                <th>Priority</th>
                                <th>Date Raised</th>
                                <th>Age</th>
                                <th>Next Follow Up</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html || '<p style="text-align: center; color: #6b7280; padding: 2rem;">No unresolved issues older than 20 days found</p>';
}

// Export functionality
function exportData() {
    const filters = currentFilters;
    
    google.script.run
        .withSuccessHandler(handleExportSuccess)
        .withFailureHandler(handleExportError)
        .exportData('csv', filters);
}

function handleExportSuccess(result) {
    if (result.success) {
        // Create and download CSV file
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `issues_export_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } else {
        alert('Export failed: ' + result.message);
    }
}

function handleExportError(error) {
    alert('Export error: ' + error);
}

// Update last update timestamp
function updateLastUpdate() {
    const element = document.getElementById('lastUpdate');
    if (element) {
        element.textContent = `Last Updated: ${new Date().toLocaleString()}`;
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getColorForIndex(index) {
    const colors = [
        '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    return colors[index % colors.length];
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    loadInitialData();
}, 5 * 60 * 1000);

console.log('Issue Tracker Dashboard initialized successfully!');
