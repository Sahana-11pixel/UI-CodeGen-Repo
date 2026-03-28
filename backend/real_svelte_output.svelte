<script>
  // --- from App.svelte ---
  let darkModeEnabled = false;

  // Dummy data for charts/tables to approximate the original layout
  const dailyStats = [
    { label: 'Daily Turnover', value: '$15,870', change: '+28%', trend: 'up', color: '#2ecc71' },
    { label: 'Overall Revenue', value: '$2,500,000', change: '-10%', trend: 'down', color: '#f39c12' },
    { label: 'New Registrations', value: '92,100', change: '+22%', trend: 'up', color: '#2ecc71' },
  ];

  const trafficSources = [
    { name: 'Direct Visits', value: '1,500,000', percentage: 100 },
    { name: 'Referral Links', value: '1,000,000', percentage: 66 },
    { name: 'Social Media', value: '500,000', percentage: 33 },
    { name: 'Advert Campaigns', value: '250,000', percentage: 16 },
    { name: 'Search Engines', value: '250,000', percentage: 16 },
  ];

  const salesDistribution = [
    { label: 'Online Sales', percentage: 65, value: '$60,000', color: '#3498db' },
    { label: 'Retail Orders', percentage: 25, value: '$20,000', color: '#f39c12' },
    { label: 'Wholesale Deals', percentage: 10, value: '$10,000', color: '#e74c3c' }, // Using an additional accent color
  ];

  const recentTransactions = [
    { img: 'https://picsum.photos/40/40?random=1', productId: '#3001', customer: 'Alice Smith', date: 'Jan 5, 24', amount: '$150', status: 'Completed' },
    { img: 'https://picsum.photos/40/40?random=2', productId: '#3002', customer: 'Bob Johnson', date: 'Jan 6, 24', amount: '$210', status: 'Pending' },
    { img: 'https://picsum.photos/40/40?random=3', productId: '#3003', customer: 'Charlie Brown', date: 'Jan 7, 24', amount: '$95', status: 'Completed' },
    { img: 'https://picsum.photos/40/40?random=4', productId: '#3004', customer: 'Diana Prince', date: 'Jan 8, 24', amount: '$320', status: 'Completed' },
    { img: 'https://picsum.photos/40/40?random=5', productId: '#3005', customer: 'Eve Adams', date: 'Jan 9, 24', amount: '$180', status: 'Pending' },
  ];
</script>

<!-- App.svelte -->
<div class="app-container {darkModeEnabled ? 'dark-mode' : ''}">
  <nav class="sidebar">
    <div class="sidebar-header">
      <span class="icon">&#x1F6CD;</span>
      <span class="brand-name">Marketplace Pro</span>
    </div>
    <div class="sidebar-search">
      <input type="text" placeholder="Search..." />
      <button class="search-btn">&#x1F50D;</button>
    </div>
    <ul class="sidebar-nav">
      <li class="nav-item active"><span class="icon">&#x1F4CA;</span>Overview</li>
      <li class="nav-item"><span class="icon">&#x1F4DD;</span>Client Requests</li>
      <li class="nav-item"><span class="icon">&#x1F4E6;</span>Catalog Items</li>
      <li class="nav-item"><span class="icon">&#x1F4C8;</span>Insights</li>
      <li class="nav-item"><span class="icon">&#x1F465;</span>Customers</li>
      <li class="nav-item"><span class="icon">&#x1F4B8;</span>Financials</li>
      <li class="nav-item"><span class="icon">&#x1F4C3;</span>Statements</li>
      <li class="nav-item"><span class="icon">&#x1F3F7;</span>Special Offers</li>
    </ul>
    <div class="sidebar-apps">
      <h4>APPLICATIONS</h4>
      <ul class="app-list">
        <li class="app-item"><span class="icon">&#x1F4AC;</span>Conversations</li>
        <li class="app-item"><span class="icon">&#x2709;</span>Messaging</li>
        <li class="app-item add-app"><span class="icon">&#x2795;</span>Add More Tools</li>
      </ul>
    </div>
    <div class="sidebar-footer">
      <ul class="settings-list">
        <li><span class="icon">&#x2699;</span>Preferences</li>
        <li><span class="icon">&#x2753;</span>Support Hub</li>
        <li class="dark-mode-toggle">
          <span class="icon">&#x1F31F;</span>Dark Theme
          <label class="switch">
            <input type="checkbox" bind:checked={darkModeEnabled}>
            <span class="slider round"></span>
          </label>
        </li>
      </ul>
      <div class="user-profile">
        <img src="https://picsum.photos/50/50?random=10" alt="User" width="50" height="50" />
        <div class="user-info">
          <p class="user-name">Rhys Sterling</p>
          <p class="user-email">rhys@markpro.com</p>
        </div>
      </div>
    </div>
  </nav>

  <main class="main-content">
    <header class="main-header">
      <div class="welcome-message">
        <h1>Hello, Valued User</h1>
        <p>Glad to see you again!</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn"><span class="icon">&#x1F50D;</span></button>
        <button class="icon-btn"><span class="icon">&#x1F514;</span></button>
        <button class="icon-btn"><span class="icon">&#x2699;</span> Customize</button>
        <button class="primary-btn"><span class="icon">&#x2795;</span> Create New</button>
      </div>
    </header>

    <section class="dashboard-grid">
      {#each dailyStats as stat}
        <div class="stat-card">
          <div class="card-header">
            <h3>{stat.label}</h3>
            <span class="icon">&#x22EF;</span>
          </div>
          <div class="card-body">
            <p class="stat-value">{stat.value}</p>
            <div class="stat-change" style="color: {stat.trend === 'up' ? '#2ecc71' : '#f39c12'}">
              <span class="icon">{stat.trend === 'up' ? '&#x2191;' : '&#x2193;'}</span>{stat.change} last month
            </div>
            <div class="chart-placeholder" style="background: linear-gradient(to top, {stat.color}40, transparent); border-color: {stat.color};"></div>
          </div>
        </div>
      {/each}
    </section>

    <section class="insights-section">
      <div class="card sales-report">
        <div class="card-header">
          <h3>Performance Overview</h3>
          <div class="period-filters">
            <button class="filter-btn active">12 Months</button>
            <button class="filter-btn">6 Months</button>
            <button class="filter-btn">30 Days</button>
            <button class="filter-btn">7 Days</button>
          </div>
          <button class="secondary-btn"><span class="icon">&#x1F4C4;</span> Download Report</button>
        </div>
        <div class="chart-area">
          <!-- Simplified chart placeholder -->
          <div class="line-chart-grid">
            <div class="y-axis-label"></div>
            <div class="chart-lines">
              <div class="line-chart-line line-blue"></div>
              <div class="line-chart-line line-orange"></div>
            </div>
            <div class="x-axis-label">Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec Jan</div>
          </div>
        </div>
      </div>

      <div class="card traffic-sources">
        <div class="card-header">
          <h3>Customer Channels</h3>
          <select class="dropdown">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
          </select>
        </div>
        <div class="source-list">
          {#each trafficSources as source}
            <div class="source-item">
              <span>{source.name}</span>
              <span>{source.value}</span>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width: {source.percentage}%; background-color: #3498db;"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="overview-section">
      <div class="card sales-distribution">
        <div class="card-header">
          <h3>Sales Distribution</h3>
          <span class="icon">&#x22EF;</span>
        </div>
        <div class="chart-and-legend">
          <div class="donut-chart-container">
            <!-- Placeholder for a donut chart using CSS circles -->
            <div class="donut-chart">
              <div class="segment s1"></div>
              <div class="segment s2"></div>
              <div class="segment s3"></div>
            </div>
          </div>
          <div class="legend-list">
            {#each salesDistribution as item}
              <div class="legend-item">
                <span class="legend-color" style="background-color: {item.color};"></span>
                <span class="legend-label">{item.label}</span>
                <span class="legend-value">{item.value}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="card recent-transactions">
        <div class="card-header">
          <h3>Recent Transactions</h3>
          <a href="#" class="view-all">See All &rarr;</a>
        </div>
        <div class="transactions-table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each recentTransactions as transaction}
                <tr>
                  <td><img src="{transaction.img}" alt="Product" width="40" height="40" /></td>
                  <td>{transaction.productId}</td>
                  <td>{transaction.customer}</td>
                  <td>{transaction.date}</td>
                  <td>{transaction.amount}</td>
                  <td>
                    <span class="status-tag {transaction.status === 'Completed' ? 'status-complete' : 'status-pending'}">
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>Displaying 5 of 12 entries</span>
          <div class="pagination">
            <button>&lt;</button>
            <button class="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>...</button>
            <button>12</button>
            <button>&gt;</button>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>

<style>
:root {
    --primary: #3498db;
    --secondary: #2ecc71;
    --accent: #f39c12;
    --background: #ecf0f1;
    --text: #2c3e50;
    --card-bg: #ffffff;
    --border-color: #e0e0e0;
    --sidebar-bg: #ffffff;
    --sidebar-text: #333;
    --active-link-bg: var(--primary);
    --active-link-text: #fff;
  }

  .dark-mode {
    --background: #2c3e50;
    --text: #ecf0f1;
    --card-bg: #34495e;
    --border-color: #44607a;
    --sidebar-bg: #34495e;
    --sidebar-text: #ecf0f1;
    --active-link-bg: var(--primary);
    --active-link-text: #fff;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .app-container {
    display: flex;
    min-height: 100vh;
    background-color: var(--background);
    color: var(--text);
  }

  .sidebar {
    width: 260px;
    padding: 20px;
    background-color: var(--sidebar-bg);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 25px;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-header .icon {
    font-size: 28px;
    color: var(--primary);
  }

  .brand-name {
    font-size: 22px;
    font-weight: bold;
    color: var(--text);
  }

  .sidebar-search {
    display: flex;
    gap: 8px;
    align-items: center;
    background-color: var(--background);
    border-radius: 8px;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
  }

  .sidebar-search input {
    flex-grow: 1;
    border: none;
    background: transparent;
    outline: none;
    color: var(--text);
    padding: 4px 0;
  }

  .sidebar-search input::placeholder {
    color: var(--text);
    opacity: 0.7;
  }

  .sidebar-search .search-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 18px;
    cursor: pointer;
  }

  .sidebar-nav, .app-list, .settings-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nav-item, .app-item, .settings-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 15px;
    border-radius: 8px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }

  .nav-item .icon, .app-item .icon, .settings-list li .icon {
    font-size: 20px;
    color: var(--text);
  }

  .nav-item:hover, .app-item:hover, .settings-list li:hover {
    background-color: var(--border-color);
  }

  .nav-item.active {
    background-color: var(--active-link-bg);
    color: var(--active-link-text);
    font-weight: bold;
  }

  .nav-item.active .icon {
    color: var(--active-link-text);
  }

  .sidebar-apps h4 {
    font-size: 14px;
    color: var(--text);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .add-app {
    color: var(--primary) !important;
    font-weight: bold;
  }

  .add-app .icon {
    color: var(--primary) !important;
  }

  .sidebar-footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
  }

  .dark-mode-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Toggle switch styling */
  .switch {
    position: relative;
    display: inline-block;
    width: 45px;
    height: 25px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border-color);
    transition: .4s;
    border-radius: 25px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--primary);
  }

  input:focus + .slider {
    box-shadow: 0 0 1px var(--primary);
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 10px;
    background-color: var(--background);
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }

  .user-profile img {
    border-radius: 50%;
    object-fit: cover;
  }

  .user-info {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-weight: bold;
    color: var(--text);
    font-size: 16px;
  }

  .user-email {
    font-size: 13px;
    color: var(--text);
    opacity: 0.7;
  }

  .main-content {
    flex-grow: 1;
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .welcome-message h1 {
    font-size: 28px;
    margin-bottom: 5px;
    color: var(--text);
  }

  .welcome-message p {
    font-size: 16px;
    color: var(--text);
    opacity: 0.8;
  }

  .header-actions {
    display: flex;
    gap: 15px;
    align-items: center;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--text);
    font-size: 18px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon-btn:hover {
    background-color: var(--border-color);
  }

  .icon-btn .icon {
    font-size: 20px;
  }

  .primary-btn {
    background-color: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s;
  }

  .primary-btn:hover {
    background-color: #2980b9;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 25px;
  }

  .card {
    background-color: var(--card-bg);
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .stat-card {
    background-color: var(--card-bg);
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-height: 180px;
    position: relative;
    overflow: hidden;
  }

  .stat-card .card-header,
  .card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-header h3 {
    font-size: 18px;
    color: var(--text);
  }

  .stat-card .icon, .card .icon {
    font-size: 20px;
    color: var(--text);
  }

  .stat-card .card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-value {
    font-size: 32px;
    font-weight: bold;
    color: var(--text);
  }

  .stat-change {
    font-size: 15px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .chart-placeholder {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 60%;
    height: 70%;
    border-left: 1px solid;
    border-top: 1px solid;
    border-top-left-radius: 15px;
    opacity: 0.5;
  }

  .insights-section {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 25px;
  }

  .sales-report {
    grid-column: span 1;
    min-height: 400px;
  }

  .traffic-sources {
    grid-column: span 1;
    min-height: 400px;
  }

  .period-filters {
    display: flex;
    gap: 10px;
  }

  .filter-btn {
    background-color: var(--background);
    border: 1px solid var(--border-color);
    padding: 8px 15px;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text);
    transition: background-color 0.2s, border-color 0.2s;
  }

  .filter-btn:hover {
    background-color: var(--border-color);
  }

  .filter-btn.active {
    background-color: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .secondary-btn {
    background-color: var(--background);
    color: var(--text);
    border: 1px solid var(--border-color);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s;
  }

  .secondary-btn:hover {
    background-color: var(--border-color);
  }

  .chart-area {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--background);
    border-radius: 8px;
    padding: 20px;
    min-height: 250px;
    position: relative;
  }

  /* Simplified line chart placeholder */
  .line-chart-grid {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: auto 1fr;
  }

  .y-axis-label {
    grid-row: 1;
    grid-column: 1;
    width: 20px;
    background-image: linear-gradient(to top, rgba(0,0,0,0.1) 1px, transparent 1px);
    background-size: 100% 25%;
  }

  .x-axis-label {
    grid-row: 2;
    grid-column: 2;
    text-align: center;
    font-size: 12px;
    color: var(--text);
    opacity: 0.7;
    padding-top: 10px;
  }

  .chart-lines {
    grid-row: 1;
    grid-column: 2;
    position: relative;
    border-bottom: 1px solid var(--border-color);
    border-left: 1px solid var(--border-color);
  }

  .line-chart-line {
    position: absolute;
    height: 100%;
    width: 100%;
    background: no-repeat linear-gradient(to right, var(--line-color));
    background-size: 100% 100%;
    mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0,80 Q20,20 40,60 T80,40 L100,50" fill="none" stroke="black" stroke-width="4"/></svg>');
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    opacity: 0.8;
  }

  .line-blue {
    --line-color: #3498db;
    mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0,70 C20,30 40,80 60,40 S80,60 100,20" fill="none" stroke="black" stroke-width="4"/></svg>');
    top: 5px;
  }

  .line-orange {
    --line-color: #f39c12;
    mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0,90 Q20,70 40,80 T80,50 L100,30" fill="none" stroke="black" stroke-width="4"/></svg>');
    top: 15px;
  }

  .dropdown {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--background);
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .source-item {
    display: grid;
    grid-template-columns: 2fr 1fr;
    align-items: center;
    gap: 10px;
  }

  .source-item span:first-child {
    font-weight: 500;
    color: var(--text);
  }

  .source-item span:last-of-type {
    text-align: right;
    font-weight: bold;
    color: var(--text);
  }

  .progress-bar-container {
    grid-column: 1 / -1;
    height: 8px;
    background-color: var(--background);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    border-radius: 4px;
  }

  .overview-section {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 25px;
  }

  .sales-distribution {
    grid-column: span 1;
    display: flex;
    flex-direction: column;
  }

  .chart-and-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 25px;
    flex-wrap: wrap;
  }

  .donut-chart-container {
    width: 150px;
    height: 150px;
    position: relative;
    border-radius: 50%;
    background: conic-gradient(
      var(--primary) 0% 65%,
      var(--accent) 65% 90%,
      #e74c3c 90% 100%
    );
    box-shadow: 0 0 0 10px var(--background);
  }

  .donut-chart-container::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    height: 60%;
    background-color: var(--card-bg);
    border-radius: 50%;
  }

  .legend-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 150px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-size: 14px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .legend-value {
    margin-left: auto;
    font-weight: bold;
  }

  .recent-transactions {
    grid-column: span 1;
  }

  .transactions-table-container {
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    color: var(--text);
  }

  th {
    background-color: var(--background);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  td img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    vertical-align: middle;
  }

  .status-tag {
    padding: 6px 10px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
    display: inline-block;
  }

  .status-complete {
    background-color: #e6ffee; /* Light green */
    color: #27ae60; /* Darker green */
  }

  .status-pending {
    background-color: #fff3e0; /* Light orange */
    color: #f39c12; /* Darker orange */
  }

  .table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 15px;
    font-size: 14px;
    color: var(--text);
  }

  .pagination {
    display: flex;
    gap: 5px;
  }

  .pagination button {
    background-color: var(--background);
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    transition: background-color 0.2s;
  }

  .pagination button:hover {
    background-color: var(--border-color);
  }

  .pagination button.active {
    background-color: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .view-all {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .view-all:hover {
    color: #2980b9;
  }

  /* Dark mode specific styles */
  .dark-mode .sidebar-search {
    background-color: #44607a;
    border-color: #55728f;
  }

  .dark-mode .filter-btn,
  .dark-mode .dropdown,
  .dark-mode .secondary-btn,
  .dark-mode .pagination button {
    background-color: #44607a;
    border-color: #55728f;
    color: var(--sidebar-text);
  }

  .dark-mode .filter-btn:hover,
  .dark-mode .secondary-btn:hover,
  .dark-mode .pagination button:hover {
    background-color: #55728f;
  }

  .dark-mode .chart-area {
    background-color: #44607a;
  }

  .dark-mode .user-profile {
    background-color: #44607a;
    border-color: #55728f;
  }

  .dark-mode .status-complete {
    background-color: #1a4f32;
    color: #5cb85c;
  }

  .dark-mode .status-pending {
    background-color: #5e461b;
    color: #ffc107;
  }
</style>