**Zyntel Dashboard Frontend Documentation**
* This document provides an exhaustive, detailed explanation of the `Zyntel Dashboard` frontend application.
* It covers everything from file structure, design principles, component breakdown, data flow, API interactions, and specific logic for each dashboard page (`TAT`, `Numbers`, `Revenue`).

**Table of Contents**
1. Project Structure
2. Deployment (Render)
    * Backend Deployment (render.yaml - Backend)
    * Frontend Deployment (render.yaml - Frontend)
3. Global Styles and Utilities
    * CSS (general.css)
    * JavaScript (filters-tat.js)
4. Dashboard Pages Overview
5. Time-In-Transit (TAT) Dashboard
    * File Paths
    * HTML Structure (tat.html)
    * Styling (tat.css)
    * JavaScript Logic (tat.js)
    * API Endpoint & Data Source
    * Initial Load & Filters
    * Data Processing (processData)
    * KPIs & Trends
    * Charts
6. Numbers Dashboard
    * File Paths
    * HTML Structure (numbers.html)
    * Styling (numbers.css)
    * JavaScript Logic (numbers.js)
    * API Endpoint & Data Source
    * Initial Load & Filters
    * Data Processing (processNumbersData)
    * KPIs & Trends
    * Charts
7. Revenue Dashboard
    * File Paths
    * HTML Structure (revenue.html)
    * Styling (primarily general.css, minimal specific overrides)
    * JavaScript Logic (revenue.js)
    * API Endpoint & Data Source
    * Initial Load & Filters
    * Data Processing (processData)
    * KPIs
    * Charts
8. Backend API Interaction (app.py)
    * Common Features
    * API Endpoints
    * Database Interactions
    * Multi-Tenancy

1. **Project Structure**
    * The Zyntel Dashboard frontend is organized within the public directory, separating HTML, CSS, JavaScript, and image assets.
            
            zyntel-v-1.0/
            ├── public/
            │   ├── css/
            │   │   ├── general.css          # Global and common CSS styles
            │   │   ├── numbers.css          # Specific styles for Numbers page
            │   │   └── tat.css              # Specific styles for TAT page
            │   ├── html/
            │   │   ├── numbers.html         # HTML for Numbers Dashboard
            │   │   ├── revenue.html         # HTML for Revenue Dashboard
            │   │   └── tat.html             # HTML for TAT Dashboard
            │   ├── images/
            │   │   ├── logo-nakasero.png    # Hospital logo
            │   │   └── zyntel_no_background.png # Zyntel logo (footer)
            │   └── js/
            │       ├── filters-tat.js       # Common date/period filter logic
            │       ├── numbers.js           # JavaScript logic for Numbers Dashboard
            │       ├── revenue.js           # JavaScript logic for Revenue Dashboard
            │       └── tat.js               # JavaScript logic for TAT Dashboard
            ├── .gitignore                   # Git ignore file
            ├── render.yaml                  # Render deployment configuration for frontend
            zyntel-backend/
            ├── app.py                       # Flask backend application
            ├── requirements.txt             # Python dependencies
            ├── render.yaml                  # Render deployment configuration for backend
    * *Note:* The paths shown above are relative to the `zyntel-v-1.0` root. Within the HTML files, references to CSS, JS, and images use relative paths like `../css/`, `../js/`, `../images/`.

2. **Deployment (Render)**
* The application is designed for deployment on Render, utilizing two separate services: a web service for the Python Flask backend and a static service for the frontend.
    **Backend Deployment (`render.yaml` - Backend)**
    * File Path: `zyntel-backend/render.yaml` (main render.yaml for the backend repository)
    * This `render.yaml` configures the Flask application (`app.py`) as a web service.
    * type: `web:` Defines this as a web service.
    * name: `zyntel-data-updater:` The name displayed in the Render dashboard.
    * env: `python:` Specifies the Python environment.
    * rootDir: `.:` Indicates that the service's root directory is the repository root, where app.py and requirements.txt reside.
    * buildCommand: ``"pip install -r `requirements.txt`":`` Installs Python dependencies.
    * startCommand: ``"gunicorn `app:app` --bind 0.0.0.0:$PORT":`` Starts the Flask application using Gunicorn. `app:app` refers to the Flask instance
    * named app within `app.py. $PORT` is a Render-provided environment variable.
    * port: `5000:` The port the Flask app listens on.
    * plan: `free:` The Render service plan.
    * envVars: Essential environment variables for database connection, Cloudflare R2, and client identification.
    * These must be securely set in the Render dashboard's service settings, as the values provided in the YAML are placeholders (`${VAR_NAME}`).
    * `DATABASE_URL`
    * `R2_ENDPOINT_URL`
    * `R2_ACCESS_KEY_ID`
    * `R2_SECRET_ACCESS_KEY`
    * `R2_BUCKET_NAME`
    * `R2_LOG_BUCKET_NAME`
    * `CLIENT_IDENTIFIER`
    **Frontend Deployment (`render.yaml` - Frontend)**
    * File Path: `zyntel-v-1.0/render.yaml` (separate render.yaml file, likely in a different repository for the frontend)
    * This `render.yaml` configures the static HTML, CSS, and JS files as a static site service.
    * type: `static:` Defines this as a static site service.
    * name: `zyntel-frontend:` The name displayed in the Render dashboard.
    * rootDir: `.:` The repository root.
    * staticPublishPath: `public:` Crucially, this tells Render that the files to be served publicly are located within the public/ subdirectory.
    * buildCommand: `"":` No build command is necessary for a simple static HTML/CSS/JS site.
    * pullRequestPreviewsEnabled: `true:` Enables Render's feature for previewing pull requests.
    
3. **Global Styles and Utilities**
* **CSS (`general.css`)**
* *File Path:* `public/css/general.css`
* This stylesheet provides the foundational visual design for the entire dashboard, ensuring a consistent look and feel across all pages.
* *Font:* Uses `Roboto` from Google Fonts (imported via @import url).
* *Color Palette (:root variables):* Defines core colors for easy theming and consistency.
* `--main-color:` #21336a; (Deep blue, primary text color, chart labels)
* `--primary-color:` #000; (Black, general text)
* `--canvas-color:` #fff; (White, background for charts/cards)
* `--hover-color:` #deab5f; (Gold/brown, for interactive elements)
* `--background-color:` rgba(250, 250, 250, 0.9); (Light off-white, header/footer background)
* `--border-bottom:` rgb(228, 228, 228); (Light grey for borders)
* `--box-shadow:` rgba(0, 0, 0, 0.05); (Subtle shadow for cards)
* *Global Resets:* * { padding: 0; margin: 0; box-sizing: border-box; } ensures consistent layout across browsers.
* *Header (<header>):*
* Fixed position at the top (position: fixed; top: 0; left: 0;).
* Full width (width: 100%;).
* High z-index (z-index: 1000;) to overlay other content.
* Background with var(--background-color) and subtle shadow.
* Height: 90px.
* Contains header-container for layout (flexbox).
* *Logo (.logo):*
* Located within header-left.
* img tag with src="`../images/zyntel_no_background.png`".
* Size: 50px height.
* Position: Top-left of the header, within the header-container. It's part of a flex container that aligns items vertically in the center.
* *Body (<body>):*
* padding-top: 150px; to account for the fixed header and filters area, preventing content from being hidden underneath.
* Main Layout (main.dashboard-layout):
* Uses Flexbox (display: flex;) to arrange the sidebar (filters/KPIs) and the charts area.
* gap: 20px; for spacing between main sections.
* margin: 20px; for overall page margin.
* Sidebar (aside.filtersContainer):
* Fixed width: 400px.
* Background: white.
* Padding, border-radius, box-shadow similar to KPI cards.
* *Filters Section:*
* Includes date pickers, period selectors, lab section, shift, and hospital unit filters.
* *KPI Cards (.kpi-card, .revenue-progress-card, .numbers-summary-card):*
* Common styling for cards displaying Key Performance Indicators.
* Background: white.
* Padding: 20px.
* Border-radius: 12px.
* Box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05).
* Display: flex, flex-direction: column, gap: 0.5rem for content arrangement.
* Labels (.kpi-label): font-size: 0.9rem, color: var(--main-color).
* Values (.kpi-value): font-size: 2.2rem, font-weight: bold.
* Trends (.kpi-trend): font-size: 0.9rem, text-align: right, margin-top: 5px.
* KPI Grid (.kpi-grid): Uses CSS Grid (display: grid; grid-template-columns: repeat(2, 1fr);) for a responsive 2-column layout of KPI cards.
* kpi-card-full-width: grid-column: 1 / -1; to span full width in the grid.
* *Charts Area (.charts-area):*
* flex: 1; to take up remaining space.
* Contains dashboard-charts (CSS Grid for chart layout).
* Chart Containers (.chart-container): Wraps <canvas> elements for consistent sizing and styling.
* *Footer (<footer>):*
* position: relative; bottom: 0; (though actual position is influenced by content flow).
* Centered text and Zyntel logo.
* Zyntel Logo: img src="`../images/zyntel_no_background.png`" in the footer, height: 30px.
* Position: Bottom left of the page content.
* Responsive Design: Includes media queries (@media (max-width: 1198px), @media (max-width: 768px)) to adjust layout for smaller screens, such as collapsing to single columns or hiding charts and showing a `Sorry! You need a wider screen` notice.
* *Print Styles:* Defines styles for printing, hiding header, filters, footer, and navigation.

* **JavaScript (filters-tat.js)**
* *File Path:* `public/js/filters-tat.js`
* This script provides common filtering logic, date handling, and dashboard initialization functionality used by `tat.js` and `numbers.js`. It does not include the `moment.js` import as `moment.js` is loaded globally via CDN in the HTML files.
* Unit Definitions: Exports arrays for inpatientUnits, outpatientUnits, and annexUnits for consistent unit categorization across dashboards.
* parseTATDate(dateStr): A utility function to parse date strings into `Moment.js` objects. It handles various date formats (M/D/YY, YYYY-MM-DD, h:mm A, etc.). While not directly used for primary date parsing by tat.js (which relies on Moment.js directly), it's kept for robustness or other modules.
* initCommonDashboard(callback):
* Purpose: Initializes shared dashboard elements, sets up event listeners for filters, and triggers the initial data load/render.
* Elements: It targets HTML elements by ID:
* periodSelect: Dropdown for date range (e.g., "Today", "Yesterday", "This Week", "This Month", "Last Month", "This Year", "Custom").
* startDateFilter, endDateFilter: Date input fields.
* labSectionFilter: Dropdown for Lab Section.
* shiftFilter: Dropdown for Shift.
* hospitalUnitFilter (Note: hospitalUnitFilter is specifically in filters-tat.js for TAT and Numbers dashboards; Revenue has its own unitSelect).
* Event Listeners: Attaches change event listeners to all filter elements. When a filter changes, it calls the provided callback function (e.g., loadAndRender for TAT, processNumbersData for Numbers).
* updateDatesForPeriod(period): Updates the startDateFilter and endDateFilter inputs based on the selected period (e.g., "today", "thisMonth"). Uses moment().startOf() and moment().endOf() for accurate date range calculation.
* Initial State: Sets the periodSelect to "thisMonth" by default and calls updateDatesForPeriod to populate the date inputs, ensuring a default date range upon load.
* applyTATFilters(data):
* Purpose: Filters a given dataset (data) based on the currently selected values in the date range, lab section, shift, and hospital unit filters.
* Logic:
* Retrieves filter values from the DOM elements.
* Converts startDate and endDate to Moment.js objects for comparison.
* Filters data array based on conditions:
* record.Date (parsed as Moment object) must be isSameOrAfter startDate and isSameOrBefore endDate.
* record.Lab_Section must match labSectionFilter (if selected).
* record.Shift must match shiftFilter (if selected).
* record.Unit must match hospitalUnitFilter (if selected).
* Returns the filteredData array.
4. Dashboard Pages Overview
The Zyntel Dashboard consists of three main pages, each focused on a specific aspect of hospital data:

TAT Dashboard (tat.html): Displays Turnaround Time (TAT) performance, focusing on delays and on-time percentages.

Numbers Dashboard (numbers.html): Shows daily and hourly request volumes, busiest periods, and request-related KPIs.

Revenue Dashboard (revenue.html): Presents revenue breakdown by date, lab section, hospital unit, and top-performing tests.

All pages share a common header (logo, title, navigation), a sidebar for filters and KPIs, a main area for charts, and a footer.

5. Time-In-Transit (TAT) Dashboard
This dashboard visualizes the TAT performance of laboratory tests.

File Paths
HTML: public/html/tat.html

CSS: public/css/tat.css (imports general.css)

JavaScript: public/js/tat.js (imports filters-tat.js)

HTML Structure (tat.html)
<!DOCTYPE html> & <head>: Standard HTML5 boilerplate.

title: "NHL Dashboard - TAT".

External Libraries (CDN):

Chart.js (https://cdn.jsdelivr.net/npm/chart.js) for charting.

chartjs-plugin-datalabels (https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels) for data labels on charts.

moment.js (https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js) for date/time manipulation.

moment-timezone (https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.34/moment-timezone-with-data.min.js) for timezone support.

chartjs-adapter-moment (https://cdn.jsdelivr.net/npm/chartjs-adapter-moment@latest/dist/chartjs-adapter-moment.min.js) to integrate Moment.js with Chart.js for time-series charts.

Internal Stylesheets:

../css/general.css (global styles).

../css/tat.css (TAT specific styles).

<body>:

Header (<header>): (Identical to other pages)

Logo: <img src="../images/logo-nakasero.png" alt="logo" /> within a div with class logo.

Position: Located at the top-left within the header, alongside the <h1>NHL Laboratory Dashboard</h1>.

Navigation (<nav>): Contains links to "TAT", "Numbers", and "Revenue" dashboards. The "TAT" link has class="active" for styling.

Main Content (<main class="dashboard-layout">):

Sidebar (<aside class="filtersContainer">):

Filters:

Period Select: <select id="periodSelect"> (options: Today, Yesterday, This Week, This Month, Last Month, This Year, Custom).

Start Date: <input type="date" id="startDateFilter" />

End Date: <input type="date" id="endDateFilter" />

Lab Section: <select id="labSectionFilter">

Shift: <select id="shiftFilter">

Hospital Unit: <select id="hospitalUnitFilter">

KPIs (.kpi-grid):

Total Tests: <div class="kpi-value" id="totalTests">

Total Delayed: <div class="kpi-value" id="totalDelayed">

On-Time Percentage: <div class="kpi-value" id="onTimePercentage">

Average TAT (hours): <div class="kpi-value" id="avgTAT">

Most Delayed Hour: <div class="kpi-value" id="mostDelayedHour">

Most Delayed Day: <div class="kpi-value" id="mostDelayedDay"> (full width kpi-card-full-width)

Charts Area (<div class="charts-area">):

TAT Performance Distribution (Pie Chart): <canvas id="tatPieChart"></canvas>

Daily TAT Performance Trend (Line Chart): <canvas id="tatLineChart"></canvas>

Hourly TAT Performance Trend (Line Chart): <canvas id="tatHourlyLineChart"></canvas>

TAT Summary Chart (Bar/Bar, Hidden, used for percentage calculation): <canvas id="tatSummaryChart"></canvas>

On-Time Summary Chart (Bar/Bar, Hidden): <canvas id="tatOnTimeSummaryChart"></canvas>

Notice (<div class="notice">): Hidden by default, displayed on small screens if charts are hidden (display: none; in CSS).

Footer (<footer>): (Identical to other pages)

&copy;2025 Zyntel

Zyntel Logo: <img src="../images/zyntel_no_background.png" alt="logo" />

Position: Bottom center of the page content.

Styling (tat.css)
File Path: public/css/tat.css

Imports general.css and provides TAT-specific visual adjustments.

Bar Wrapper Styling (.chart-bar-wrapper): Defines height, margin, background, border-radius, and flex properties for chart bars.

Canvas Sizing: Ensures tatSummaryChart and tatOnTimeSummaryChart fill their wrappers with width: 100% !important; height: 100% !important;.

KPI Grid (.kpi-grid):

display: grid; grid-template-columns: repeat(2, 1fr); for a 2-column layout.

gap: 10px; for spacing.

margin-top: 1rem;

Full-Width KPI Card (.kpi-grid .kpi-card-full-width): grid-column: 1 / -1; makes the element span all columns within the grid (e.g., "Most Delayed Day").

KPI Trend Arrows:

.kpi-trend .positive: color: green; font-weight: bold; for good trends.

.kpi-trend .negative: color: red; font-weight: bold; for bad trends.

JavaScript Logic (tat.js)
File Path: public/js/tat.js

This script handles data fetching, processing, KPI calculation, and chart rendering for the TAT dashboard. It heavily leverages filters-tat.js.

API Endpoint & Data Source (TAT)
API_URL = "https://zyntel-data-updater.onrender.com/api/performance-data";

Data Source: Fetches data from the backend's /api/performance-data endpoint. This endpoint retrieves data from the Performance table in the PostgreSQL database.

Relevant Columns from Performance table:

id

date

shift

lab_number

unit

request_time_in

daily_tat

request_time_expected

request_time_out

request_delay_status

request_time_range

client

Initial Load & Filters (TAT)
DOMContentLoaded event listener:

Sets periodSelect.value = "thisMonth" and calls updateDatesForPeriod("thisMonth") to ensure default date inputs are populated upon page load.

Calls initCommonDashboard(loadAndRender): This initializes the common filters from filters-tat.js and sets loadAndRender as the callback function to be executed whenever filters change or on initial load.

loadData():

Fetches data from API_URL using fetch.

Parses the JSON response.

Stores raw data in allData.

Adds a parsedDate Moment.js object to each record for easier date filtering.

loadAndRender():

Called after filters are set up by initCommonDashboard or when filters change.

Calls loadData() to fetch the latest data.

Filters allData using applyTATFilters() from filters-tat.js, storing the result in filteredData.

Calls processData() to perform calculations and render charts/KPIs.

Data Processing (processData) (TAT)
This function aggregates filteredData and calculates all KPIs and chart data.

Data Aggregation:

Counts totalTests, totalDelayed, totalOnTime, totalNotUploaded.

Calculates onTimePercentage = (totalOnTime / totalTests) * 100.

Calculates totalTATSum and totalDailyTATSum for average TAT.

Aggregates data by hour (hourlyPerformance) and day (dailyPerformance) to determine delayed/on-time counts.

KPI Calculations:

totalTests: Count of records in filteredData.

totalDelayed: Count where record.request_delay_status === 'Delayed'.

onTimePercentage: Percentage of records where request_delay_status is 'On-Time'.

avgTAT: Average of record.daily_tat.

mostDelayedHour, mostDelayedDay: Determined by finding the hour/day with the highest count of 'Delayed' requests.

Trend Calculations (updateTrend function, imported from numbers.js in a shared utility context for trend arrow styling):

updateTrend(elementId, value, isPositiveGood): Updates the text and visual arrow (▲, ▼, —) for KPI trends based on value and whether a positive value is "good" (e.g., increased revenue is good, increased delay is bad).

TAT-specific Trend Logic: Calculates percentage changes for onTimePercentageTrend, avgTATTrend, totalTestsTrend, totalDelayedTrend. Requires previous period data (not explicitly shown in the provided tat.js but implies comparison with a prior filteredData state or an API for previous period data).

KPIs & Trends (TAT)
Total Tests (totalTests): Total count of individual test records for the filtered period.

Total Delayed (totalDelayed): Count of tests with request_delay_status as 'Delayed'.

On-Time Percentage (onTimePercentage): Percentage of tests completed 'On-Time'.

Target/Good Trend: Higher percentage is better (positive isPositiveGood flag).

Average TAT (hours) (avgTAT): Average Turnaround Time in hours.

Target/Good Trend: Lower average is better (negative isPositiveGood flag).

Most Delayed Hour (mostDelayedHour): The hour of the day (0-23) with the highest number of delayed tests.

Most Delayed Day (mostDelayedDay): The day of the week (e.g., Monday, Tuesday) with the highest number of delayed tests.

Charts (TAT)
All charts use Chart.js. Existing chart instances are destroyed before recreation to prevent memory leaks and ensure fresh renders.

TAT Performance Distribution (tatPieChart):

Type: doughnut chart.

Data: Shows the distribution of tests by request_delay_status (Delayed, On-Time, Not Uploaded).

Colors: Delayed: #ff6384 (red), On-Time: #4caf50 (green), Not Uploaded: #9E9E9E (grey).

Plugins: ChartDataLabels to show percentages directly on segments.

Daily TAT Performance Trend (tatLineChart):

Type: line chart.

Data: Plots daily counts of Delayed, On-Time, and Not Uploaded tests over time.

X-axis: Date (time scale using chartjs-adapter-moment).

Y-axis: Count of tests.

Line Styling: No dots, rigid lines (tension: 0), borderWidth: 2.

Hourly TAT Performance Trend (tatHourlyLineChart):

Type: line chart.

Data: Plots hourly counts of Delayed, On-Time, and Not Uploaded tests across a 24-hour cycle.

X-axis: Hour of Day (0-23).

Y-axis: Count of tests.

Line Styling: Same as daily trend.

Hidden Summary Charts (tatSummaryChart, tatOnTimeSummaryChart):

These are bar charts used internally to calculate percentages for the KPI display, particularly for the progress bars. They are likely rendered within a small, hidden div or are just used for Chart.js's internal data processing capabilities without being visibly rendered.

6. Numbers Dashboard
This dashboard focuses on the volume of requests and their distribution by time.

File Paths
HTML: public/html/numbers.html

CSS: public/css/numbers.css (imports general.css)

JavaScript: public/js/numbers.js (imports filters-tat.js)

HTML Structure (numbers.html)
<!DOCTYPE html> & <head>: Standard HTML5 boilerplate.

title: "NHL Dashboard - Numbers".

External Libraries (CDN): Same as tat.html (Chart.js, datalabels, moment.js, moment-timezone, chartjs-adapter-moment).

Internal Stylesheets:

../css/general.css (global styles).

../css/numbers.css (Numbers specific styles).

<body>:

Header (<header>): (Identical to other pages)

Logo: <img src="../images/logo-nakasero.png" alt="logo" />

Position: Top-left of the header.

Navigation (<nav>): "Numbers" link has class="active".

Main Content (<main class="dashboard-layout">):

Sidebar (<aside class="filtersContainer">):

Filters: Same filter types as TAT dashboard (Period, Start Date, End Date, Lab Section, Shift, Hospital Unit).

KPIs (.kpi-grid):

Total Requests: <div class="kpi-value" id="totalRequests">

Average Daily Requests: <div class="kpi-value" id="avgDailyRequests">

Busiest Hour: <div class="kpi-value" id="busiestHour">

Busiest Day: <div class="kpi-value" id="busiestDay"> (full width kpi-card-full-width)

Charts Area (<div class="charts-area">):

Daily Request Volume (Bar Chart): <canvas id="dailyNumbersBarChart"></canvas>

Hourly Request Volume (Line Chart): <canvas id="hourlyNumbersLineChart"></canvas>

Notice (<div class="notice">): Hidden by default, displayed on small screens.

Footer (<footer>): (Identical to other pages)

Zyntel Logo: <img src="../images/zyntel_no_background.png" alt="logo" />

Position: Bottom center of the page content.

Styling (numbers.css)
File Path: public/css/numbers.css

Imports general.css and provides Numbers-specific visual adjustments.

Summary Card Positioning (.numbers-summary-card): position: sticky; top: 200px; to keep it visible while scrolling, positioned below the header/filters.

Max Width: max-width: 400px; for the summary card.

KPI Grid: Explicitly defines grid-template-columns: repeat(2, 1fr); for the KPI grid and grid-column: 1 / -1; for kpi-card-full-width (Busiest Day).

Responsive Adjustments: Media queries further adjust the top positioning and width of the summary card for smaller screens.

JavaScript Logic (numbers.js)
File Path: public/js/numbers.js

This script handles data fetching, processing, KPI calculation, and chart rendering for the Numbers dashboard. It also leverages filters-tat.js for common filter logic.

API Endpoint & Data Source (Numbers)
API_URL = "https://zyntel-data-updater.onrender.com/api/performance-data"; (Same as TAT, as performance-data includes request_time_in needed for counting requests).

Data Source: Fetches data from the backend's /api/performance-data endpoint. This endpoint retrieves data from the Performance table in the PostgreSQL database.

Relevant Columns from Performance table:

id

date

shift

lab_number

unit

request_time_in

client

Initial Load & Filters (Numbers)
DOMContentLoaded event listener:

Calls loadData() to fetch the initial dataset.

Calls initCommonDashboard(processNumbersData): This initializes the common filters and sets processNumbersData as the callback to be executed when filters change or on initial load.

loadData():

Fetches data from API_URL using fetch.

Parses the JSON response.

Stores raw data in allData.

Adds a parsedDate Moment.js object to each record and parses request_time_in for easier time-based aggregations.

processNumbersData():

Called after filters are set up by initCommonDashboard or when filters change.

Filters allData using applyTATFilters() from filters-tat.js, storing the result in filteredData.

Performs all KPI calculations and prepares data for charts.

Data Processing (processNumbersData)
This function aggregates filteredData and calculates all KPIs and chart data for the Numbers dashboard.

Data Aggregation:

Aggregates totalRequests, dailyCounts, hourlyCounts, dayOfWeekCounts.

Calculates avgDailyRequests based on totalRequests and number of unique days.

Determines busiestHour and busiestDay by finding the maximum counts in hourlyCounts and dayOfWeekCounts.

KPI Calculations:

totalRequests: Total count of records in filteredData.

avgDailyRequests: totalRequests divided by the number of unique days in the filtered period.

busiestHour: Hour (0-23) with the highest number of requests.

busiestDay: Day of the week with the highest number of requests.

Trend Calculations (updateTrend function):

updateTrend(elementId, value, isPositiveGood): This is the actual updateTrend function, defined within numbers.js. It takes an element ID, a percentage value, and a boolean isPositiveGood to determine the arrow (▲/▼/—) and color (green/red/neutral).

Numbers-specific Trend Logic: Calculates totalRequestsChange and avgDailyRequestsChange (percentage change from a previous period, which is assumed to be available as previousTotalRequests and previousAvgDailyRequests). busiestHourTrend and busiestDayTrend are hardcoded to 0 or N/A as "No specific previous values for busiest hour/day trends".

Targets: Not explicitly defined in code, but implied that positive trends for total requests and average daily requests are "good".

KPIs & Trends (Numbers)
Total Requests (totalRequests): Total count of requests within the filtered period.

Trend: Higher total requests are generally good.

Average Daily Requests (avgDailyRequests): Average number of requests per day within the filtered period.

Trend: Higher average daily requests are generally good.

Busiest Hour (busiestHour): The hour (e.g., "14:00") with the highest number of requests.

Busiest Day (busiestDay): The day of the week (e.g., "Tuesday") with the highest number of requests.

Charts (Numbers)
All charts use Chart.js.

Daily Request Volume (dailyNumbersBarChart):

Type: bar chart.

Data: Shows the number of requests per day.

X-axis: Date (time scale using chartjs-adapter-moment).

Y-axis: Number of Requests.

Hourly Request Volume (hourlyNumbersLineChart):

Type: line chart.

Data: Shows the total number of requests for each hour of the day (0-23).

X-axis: Hour of Day.

Y-axis: Number of Requests.

7. Revenue Dashboard
This dashboard focuses on revenue generated by tests, broken down by various categories.

File Paths
HTML: public/html/revenue.html

CSS: public/css/general.css (minimal specific CSS, primarily relies on general.css)

JavaScript: public/js/revenue.js

HTML Structure (revenue.html)
<!DOCTYPE html> & <head>: Standard HTML5 boilerplate.

title: "NHL Dashboard - Revenue".

External Libraries (CDN): Same as tat.html and numbers.html (Chart.js, datalabels, moment.js, moment-timezone, chartjs-adapter-moment).

Internal Stylesheets: ../css/general.css (primary stylesheet).

<body>:

Header (<header>): (Identical to other pages)

Logo: <img src="../images/logo-nakasero.png" alt="logo" />

Position: Top-left of the header.

Navigation (<nav>): "Revenue" link has class="active".

Main Content (<main class="dashboard-layout">):

Sidebar (<aside class="filtersContainer">):

Filters:

Period Select: <select id="periodSelect">

Start Date: <input type="date" id="startDateFilter" />

End Date: <input type="date" id="endDateFilter" />

Lab Section: <select id="labSectionFilter">

Shift: <select id="shiftFilter">

Revenue Progress Card (<div class="revenue-progress-card">): Contains "Total Revenue" KPI and a progress bar (chart).

Total Revenue: <div class="kpi-value" id="totalRevenue">

Revenue Progress Bar (Chart): <canvas id="revenueBarChart"></canvas>

Charts Area (<div class="charts-area">):

Revenue by Date (Line Chart): <canvas id="revenueChart"></canvas>

Revenue by Lab Section (Bar Chart): <canvas id="sectionRevenueChart"></canvas>

Revenue by Hospital Unit (Bar Chart): <canvas id="hospitalUnitRevenueChart"></canvas>

Top Tests (Bar Chart, with Unit Select): <label for="unitSelect">Select Hospital Unit:</label><select id="unitSelect"></select><canvas id="topTestsChart"></canvas>

Revenue by Test (Bar Chart): <canvas id="testRevenueChart"></canvas>

Test Volume (Bar Chart): <canvas id="testCountChart"></canvas>

Notice (<div class="notice">): Hidden by default, displayed on small screens.

Footer (<footer>): (Identical to other pages)

Zyntel Logo: <img src="../images/zyntel_no_background.png" alt="logo" />

Position: Bottom center of the page content.

Styling (primarily general.css, minimal specific overrides)
The revenue.html page primarily relies on general.css for its layout and component styling. There are no significant overrides or additions in a separate revenue.css file provided, implying that the common styles are sufficient.

The revenue-progress-card uses the general KPI card styling from general.css.

The unitSelect-label for "Select Hospital Unit" is styled to be bold and match --main-color, as defined in tat.css and potentially included/implied by general.css as a common component style.

JavaScript Logic (revenue.js)
File Path: public/js/revenue.js

This script handles data fetching, processing, KPI calculation, and chart rendering for the Revenue dashboard.

API Endpoint & Data Source (Revenue)
API_URL = "https://zyntel-data-updater.onrender.com/api/revenue-data";

Data Source: Fetches data from the backend's /api/revenue-data endpoint. This endpoint retrieves data from the Revenue table in the PostgreSQL database.

Relevant Columns from Revenue table:

ID

Date

Shift

Lab_Number

Unit

Lab_Section

Test_Name

Price

Client

Initial Load & Filters (Revenue)
DOMContentLoaded event listener:

Calls loadData() to fetch the initial dataset.

Initializes filter event listeners: startDateFilter, endDateFilter, periodSelect, labSectionFilter, shiftFilter, unitSelect.

Sets periodSelect.value = "thisMonth" by default.

Calls applyFilters() and processData() to render initial state.

loadData():

Fetches data from API_URL using fetch.

Parses the JSON response.

Stores raw data in allData.

Adds a parsedDate Moment.js object to each record for easier date filtering.

applyFilters():

Purpose: Filters the allData based on selected date range, lab section, shift, and hospital unit.

Logic: Similar to applyTATFilters but adapted for the revenue.js context, directly retrieving values from the DOM elements for date range, labSectionFilter, shiftFilter, and unitSelect.

Updates filteredData.

Data Processing (processData) (Revenue)
This function aggregates filteredData and calculates all KPIs and chart data for the Revenue dashboard.

Data Aggregation:

aggregatedRevenueByDate: Sums Price by Date.

aggregatedRevenueBySection: Sums Price by Lab_Section.

aggregatedRevenueByUnit, aggregatedTestCountByUnit: Sums Price and counts tests by Unit.

aggregatedRevenueByTest, aggregatedCountByTest: Sums Price and counts tests by Test_Name.

KPI Calculations:

totalRevenue: Sum of Price from filteredData.

Targets: No explicit numerical targets are hardcoded in the provided revenue.js for revenue KPIs. Trends are not explicitly calculated or displayed for revenue data in the same way as TAT or Numbers, though Chart.js can implicitly show trends over time.

KPIs (Revenue)
Total Revenue (totalRevenue): The sum of Price for all filtered tests. This is a primary KPI on the Revenue dashboard.

Charts (Revenue)
All charts use Chart.js. Existing chart instances are destroyed before recreation.

Revenue Progress Bar (revenueBarChart):

Type: bar chart (horizontal).

Data: Visually represents the totalRevenue. Its configuration (e.g., max value, segment colors) would define it as a "progress bar." (Based on the HTML structure, this is likely a single bar representing total revenue against a target, though the target isn't explicit in the JS).

Plugins: ChartDataLabels for showing the value.

Revenue by Date (revenueChart):

Type: line chart.

Data: Plots total revenue per day.

X-axis: Date (time scale).

Y-axis: Revenue.

Revenue by Lab Section (sectionRevenueChart):

Type: bar chart.

Data: Shows total revenue for each Lab_Section.

X-axis: Lab Section names.

Y-axis: Revenue.

Revenue by Hospital Unit (hospitalUnitRevenueChart):

Type: bar chart.

Data: Shows total revenue for each Unit.

X-axis: Hospital Unit names.

Y-axis: Revenue.

Top Tests (topTestsChart):

Type: bar chart.

Data: Displays revenue for individual Test_Names, filtered by the unitSelect dropdown. This chart is dynamically updated based on the selected unit.

X-axis: Test Names.

Y-axis: Revenue.

Revenue by Test (testRevenueChart):

Type: bar chart.

Data: Similar to topTestsChart but likely for all tests, showing revenue per test.

Test Volume (testCountChart):

Type: bar chart.

Data: Shows the count (volume) of each Test_Name.

X-axis: Test Names.

Y-axis: Test Count.

8. Backend API Interaction (app.py)
File Path: app.py

The Flask backend serves as the data API for the frontend dashboards.

Common Features
Flask Application: Initializes a Flask app.

CORS: CORS(app) enables Cross-Origin Resource Sharing, allowing the frontend (served from a different origin on Render) to make requests to the backend. In production, this should be restricted to known frontend origins.

Flask-Compress: Compress(app) enables Gzip compression for API responses, reducing bandwidth usage and improving load times for the frontend.

Environment Variables (dotenv): Uses python-dotenv to load environment variables (like DATABASE_URL, CLIENT_IDENTIFIER) from a .env file during local development and from Render's environment settings in deployment.

Database Connection (psycopg2): Uses psycopg2 to connect to a PostgreSQL database specified by DATABASE_URL. It uses RealDictCursor to fetch query results as dictionaries, which is convenient for JSON serialization.

Error Handling: Includes try-except-finally blocks for API endpoints to catch exceptions, log errors, and return appropriate 500 status codes with error messages.

API Endpoints
/api/revenue-data (GET):

Purpose: Fetches all revenue-related data for the CLIENT_IDENTIFIER.

Database Table: Queries the revenue table.

Response: Returns a JSON array of records, with Decimal values converted to float for client-side consumption.

/api/performance-data (GET):

Purpose: Fetches performance (TAT) data for the CLIENT_IDENTIFIER.

Database Table: Queries the performance table.

Response: Returns a JSON array of records, with Decimal values (e.g., daily_tat) converted to float.

Note: This single endpoint serves both the TAT dashboard and the Numbers dashboard, as both rely on the performance table.

/admin/trigger-ingestion (POST):

Purpose: An administrative endpoint to manually trigger the data ingestion process.

Mechanism: Starts the run_data_ingestion() function (from populate_db.py) in a separate threading.Thread. This is crucial to prevent the API request from blocking while data is being processed, allowing the frontend to receive an immediate "ingestion started" response.

Response: Returns a 202 Accepted status with a message indicating the process has started in the background.

Database Interactions
The Flask API directly interacts with the Revenue and Performance tables, as well as implicitly relies on the populate_db.py script to ensure these tables are created and populated.

Multi-Tenancy
FLASK_CLIENT_IDENTIFIER = os.environ.get("CLIENT_IDENTIFIER", "DefaultClient"): The Flask app retrieves a CLIENT_IDENTIFIER from environment variables.

WHERE client = %s: All data fetching queries include a WHERE client = %s clause, ensuring that each client only accesses data relevant to their CLIENT_IDENTIFIER. This provides a basic multi-tenancy capability, segmenting data by client.