// ========================================
// CONFIGURATION - UPDATE THIS URL
// ========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzBRuHnP5GPLUmZICBV7DG_t0pHvC7HPvs5i8_4VM3MH9enxdPv4T8oqayFDyTX8AE0kg/exec';
// Example: 'https://script.google.com/macros/s/AKfycbx.../exec'

// ========================================
// GLOBAL VARIABLES
// ========================================
var currentUser = "";
var currentUserType = "";
var mobilesData = [];
var imeiStockData = [];

// ========================================
// API HELPER FUNCTION
// ========================================
async function callAPI(action, data = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: action,
                data: JSON.stringify(data)
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        return result.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ========================================
// TIME DISPLAY
// ========================================
function updateTime() {
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleString();
}
setInterval(updateTime, 1000);
updateTime();

// ========================================
// PAGE LOAD INITIALIZATION
// ========================================
document.addEventListener("DOMContentLoaded", async function () {
    // Set today's date
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("dateField").value = yyyy + "-" + mm + "-" + dd;
    
    // Event listeners
    document.getElementById("qtyField").addEventListener("input", updateAmounts);
    document.getElementById("rateField").addEventListener("input", updateAmounts);
    document.getElementById("cgstField").addEventListener("input", updateAmounts);
    document.getElementById("sgstField").addEventListener("input", updateAmounts);
    document.getElementById("setNameDropdown").addEventListener("change", updateVariantDropdown);
    document.getElementById("variantDropdown").addEventListener("change", fetchPrice);
    document.getElementById("sendMethod").addEventListener("change", toggleSendFields);
    
    // Form submissions
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("invoiceForm").addEventListener("submit", handleFormSubmit);
    document.getElementById("mobileForm").addEventListener("submit", submitMobile);
    
    updateAmounts();
});

// ========================================
// UTILITY FUNCTIONS
// ========================================
function toISODate(mdyString) {
    if (!mdyString) return "";
    if (mdyString.match(/^\d{4}-\d{2}-\d{2}$/)) return mdyString;
    var parts = mdyString.split("/");
    if (parts.length === 3) {
        var m = parts[0].padStart(2, "0");
        var d = parts[1].padStart(2, "0");
        var y = parts[2];
        return y + "-" + m + "-" + d;
    }
    return "";
}

function updateAmounts() {
    var qty = parseFloat(document.getElementById("qtyField").value) || 0;
    var rate = parseFloat(document.getElementById("rateField").value) || 0;
    var baseAmount = qty * rate;
    var cgstPercentage = parseFloat(document.getElementById("cgstField").value) || 0;
    var sgstPercentage = parseFloat(document.getElementById("sgstField").value) || 0;
    var cgstAmount = baseAmount * (cgstPercentage / 100);
    var sgstAmount = baseAmount * (sgstPercentage / 100);
    var grandTotal = baseAmount + cgstAmount + sgstAmount;
    document.getElementById("amountDisplay").textContent = baseAmount.toFixed(2);
    document.getElementById("baseAmountDisplay").textContent = baseAmount.toFixed(2);
    document.getElementById("grandTotalDisplay").textContent = grandTotal.toFixed(2);
}

// ========================================
// LOGIN FUNCTION
// ========================================
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get("username");
    const password = formData.get("password");
    
    try {
        const res = await callAPI('login', { username, password });
        currentUser = res.username;
        currentUserType = res.userType;
        document.getElementById("currentUserField").value = currentUser;
        document.getElementById("currentUserTypeField").value = currentUserType;
        document.getElementById("headerUser").textContent = "Logged in as: " + currentUser;
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("dashboardSection").style.display = "block";
        
        if (currentUserType === "Admin") {
            document.getElementById("adminControls").style.display = "block";
        }
        
        // Load sets for dropdown
        const sets = await callAPI('getSetNames');
        var options = "<option value=''>Select Set</option>";
        sets.forEach(function(s) { 
            options += "<option value='" + s + "'>" + s + "</option>"; 
        });
        document.getElementById("setNameDropdown").innerHTML = options;
        
        // Get new invoice number
        const invoiceNo = await callAPI('getNewInvoiceNumber');
        document.getElementById("invoiceNumberField").value = invoiceNo;
        
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

// ========================================
// FORM SUBMISSION
// ========================================
async function handleFormSubmit(event) {
    event.preventDefault();
    var formData = new FormData(event.target);
    var obj = {};
    formData.forEach(function (value, key) { obj[key] = value; });
    
    try {
        const response = await callAPI('processForm', obj);
        Swal.fire({ 
            title: "Success!", 
            text: response, 
            icon: "success", 
            confirmButtonText: "OK" 
        });
        
        if (!document.getElementById("historySection").classList.contains("hidden")) {
            loadHistory();
        }
    } catch (err) {
        Swal.fire({ 
            title: "Error!", 
            text: "Error: " + err.message, 
            icon: "error", 
            confirmButtonText: "OK" 
        });
    }
}

// ========================================
// MOBILE DROPDOWN FUNCTIONS
// ========================================
async function updateVariantDropdown() {
    var setName = document.getElementById("setNameDropdown").value;
    if (!setName) {
        document.getElementById("variantDropdown").innerHTML = "<option value=''>Select Variant</option>";
        return;
    }
    
    try {
        const variants = await callAPI('getVariantsForSet', { setName });
        var options = "<option value=''>Select Variant</option>";
        variants.forEach(function (v) {
            options += "<option value='" + v + "'>" + v + "</option>";
        });
        document.getElementById("variantDropdown").innerHTML = options;
    } catch (err) {
        console.error('Error loading variants:', err);
    }
}

async function fetchPrice() {
    var setName = document.getElementById("setNameDropdown").value;
    var variant = document.getElementById("variantDropdown").value;
    if (!setName || !variant) return;
    
    try {
        const mobile = await callAPI('getMobileDetail', { setName, variant });
        if (mobile) {
            document.getElementById("rateField").value = mobile.price;
            updateAmounts();
        }
    } catch (err) {
        console.error('Error fetching price:', err);
    }
}

// ========================================
// SEND INVOICE FUNCTIONS
// ========================================
function openSendModal() {
    document.getElementById("sendModal").style.display = "flex";
}

function closeSendModal() {
    document.getElementById("sendModal").style.display = "none";
    document.getElementById("whatsappNumber").value = "";
    document.getElementById("emailAddress").value = "";
}

function toggleSendFields() {
    var method = document.getElementById("sendMethod").value;
    document.getElementById("whatsappField").style.display = method === "whatsapp" ? "block" : "none";
    document.getElementById("emailField").style.display = method === "email" ? "block" : "none";
}

async function sendInvoice() {
    var method = document.getElementById("sendMethod").value;
    var number = document.getElementById("whatsappNumber").value;
    var email = document.getElementById("emailAddress").value;
    
    if (method === "whatsapp" && !number) {
        Swal.fire("Error", "Please enter WhatsApp number", "error");
        return;
    }
    
    if (method === "email" && !email) {
        Swal.fire("Error", "Please enter email address", "error");
        return;
    }
    
    var invoiceData = collectInvoiceData();
    
    Swal.fire({
        title: 'Generating PDF...',
        text: 'Please wait while we create your invoice PDF',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    try {
        const response = await callAPI('sendInvoice', {
            invoiceData,
            method,
            recipient: method === "whatsapp" ? number : email
        });
        
        Swal.close();
        
        if (method === "whatsapp") {
            if (response.url) {
                window.open(response.url, "_blank");
            }
            if (response.pdfUrl) {
                Swal.fire({
                    title: "Success!",
                    html: "WhatsApp message prepared!<br><br>PDF Invoice Link: <a href='" + response.pdfUrl + "' target='_blank'>Download PDF</a>",
                    icon: "success",
                    confirmButtonText: "OK"
                });
            }
        } else {
            Swal.fire("Success", "Email with PDF invoice sent successfully!", "success");
        }
        closeSendModal();
    } catch (err) {
        Swal.close();
        Swal.fire("Error", "Failed to send invoice: " + err.message, "error");
    }
}

function collectInvoiceData() {
    return {
        invoiceNo: document.getElementById("invoiceNumberField").value,
        date: document.getElementById("dateField").value,
        name: document.querySelector('input[name="name"]').value,
        address: document.querySelector('input[name="address"]').value,
        contact: document.querySelector('input[name="contact"]').value,
        setName: document.getElementById("setNameDropdown").value,
        variant: document.getElementById("variantDropdown").value,
        modelNo: document.querySelector('input[name="modelNo"]').value,
        imei1: document.querySelector('input[name="imei1"]').value,
        imei2: document.querySelector('input[name="imei2"]').value,
        qty: document.getElementById("qtyField").value,
        rate: document.getElementById("rateField").value,
        baseAmount: document.getElementById("baseAmountDisplay").textContent,
        cgst: document.getElementById("cgstField").value,
        sgst: document.getElementById("sgstField").value,
        grandTotal: document.getElementById("grandTotalDisplay").textContent
    };
}

// ========================================
// OTHER UTILITY FUNCTIONS
// ========================================
function clearForm() {
    document.getElementById("invoiceForm").reset();
    document.getElementById("dateField").value = "";
    document.getElementById("amountDisplay").textContent = "0.00";
    document.getElementById("baseAmountDisplay").textContent = "0.00";
    document.getElementById("grandTotalDisplay").textContent = "0.00";
    document.getElementById("currentUserField").value = currentUser;
    document.getElementById("currentUserTypeField").value = currentUserType;
}

async function newInvoice() {
    document.getElementById("historySection").classList.add("hidden");
    document.getElementById("stockSection").style.display = "none";
    document.getElementById("imeiStockSection").style.display = "none";
    document.getElementById("invoiceForm").style.display = "block";
    document.getElementById("invoiceForm").reset();
    updateAmounts();
    
    var today = new Date();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    var yyyy = today.getFullYear();
    document.getElementById("dateField").value = yyyy + "-" + mm + "-" + dd;
    
    try {
        const newInvoiceNo = await callAPI('getNewInvoiceNumber');
        document.getElementById("invoiceNumberField").value = newInvoiceNo;
    } catch (err) {
        console.error('Error getting new invoice number:', err);
    }
}

function toggleHistory() {
    document.getElementById("invoiceForm").style.display = "none";
    document.getElementById("stockSection").style.display = "none";
    document.getElementById("imeiStockSection").style.display = "none";
    document.getElementById("loadingIndicator").classList.remove("hidden");
    loadHistory();
}

function backToInvoice() {
    document.getElementById("historySection").classList.add("hidden");
    document.getElementById("invoiceForm").style.display = "block";
}

async function loadHistory() {
    try {
        const data = await callAPI('getAllInvoices', { currentUser, currentUserType });
        renderHistoryTable(data);
        document.getElementById("loadingIndicator").classList.add("hidden");
        document.getElementById("historySection").classList.remove("hidden");
    } catch (err) {
        Swal.fire("Error", "Failed to load history: " + err.message, "error");
    }
}

function renderHistoryTable(data) {
    if ($.fn.DataTable.isDataTable("#historyTable")) {
        $("#historyTable").DataTable().clear().destroy();
    }
    var tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";
    data.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.invoiceNo}</td>
            <td>${row.date}</td>
            <td>${row.name}</td>
            <td>${row.contact}</td>
            <td>${row.setName} - ${row.variant}</td>
            <td>${row.imeiDisplay || 'N/A'}</td>
            <td>₹${row.baseAmount || 0}</td>
            <td>${row.user || ""}</td>
            <td>
                <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded" onclick="viewInvoice('${row.invoiceNo}')">
                    View
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    $("#historyTable").DataTable({ 
        responsive: true, 
        autoWidth: false, 
        width: "100%",
        pageLength: 25
    });
}

function filterByDate() {
    var start = document.getElementById("startDate").value;
    var end = document.getElementById("endDate").value;
    var table = $("#historyTable").DataTable();
    $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
        var date = data[1] || "";
        if (date) {
            var parts = date.split("/");
            var invoiceDate = new Date(parts[2], parts[0] - 1, parts[1]);
            if (start) {
                var startDate = new Date(start);
                if (invoiceDate < startDate) return false;
            }
            if (end) {
                var endDate = new Date(end);
                if (invoiceDate > endDate) return false;
            }
        }
        return true;
    });
    table.draw();
    $.fn.dataTable.ext.search.pop();
}

function clearFilter() {
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    $("#historyTable").DataTable().draw();
}

async function viewInvoice(invoiceNo) {
    try {
        const inv = await callAPI('getInvoiceByNo', { invoiceNo, currentUser, currentUserType });
        
        if (!inv) {
            Swal.fire("Not found", "No invoice found or no permission.", "error");
            return;
        }
        
        document.getElementById("invoiceNumberField").value = inv.invoiceNo || "";
        document.getElementById("dateField").value = toISODate(inv.date || "");
        document.querySelector('input[name="name"]').value = inv.name || "";
        document.querySelector('input[name="address"]').value = inv.address || "";
        document.querySelector('input[name="contact"]').value = inv.contact || "";
        document.getElementById("setNameDropdown").value = inv.setName || "";
        
        await updateVariantDropdown();
        
        setTimeout(function () {
            document.getElementById("variantDropdown").value = inv.variant || "";
            fetchPrice();
        }, 300);
        
        document.querySelector('input[name="modelNo"]').value = inv.modelNo || "";
        document.querySelector('input[name="imei1"]').value = inv.imei1 || "";
        document.querySelector('input[name="imei2"]').value = inv.imei2 || "";
        document.getElementById("qtyField").value = inv.qty || 0;
        document.getElementById("rateField").value = inv.rate || 0;
        document.getElementById("cgstField").value = inv.cgstPercentage || 0;
        document.getElementById("sgstField").value = inv.sgstPercentage || 0;
        updateAmounts();
        backToInvoice();
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

function logout() {
    currentUser = "";
    currentUserType = "";
    document.getElementById("loginSection").style.display = "flex";
    document.getElementById("dashboardSection").style.display = "none";
    document.getElementById("invoiceForm").reset();
    document.getElementById("historySection").innerHTML = "";
}

// ========================================
// ADMIN MOBILE MANAGEMENT
// ========================================
function openAddMobileModal() {
    document.getElementById("adminModal").style.display = "flex";
    document.getElementById("mobileForm").reset();
    document.getElementById("mobileForm").removeAttribute("data-row");
}

function closeAddMobileModal() {
    document.getElementById("adminModal").style.display = "none";
    document.getElementById("mobileForm").reset();
    document.getElementById("mobileForm").removeAttribute("data-row");
}

async function submitMobile(e) {
    e.preventDefault();
    var mobile = {
        setName: document.getElementById("mobileSetName").value,
        variant: document.getElementById("mobileVariant").value,
        price: parseFloat(document.getElementById("mobilePrice").value) || 0,
        imeis: document.getElementById("mobileImeis").value.split('\n').filter(imei => imei.trim() !== '')
    };
    
    if (mobile.imeis.length === 0) {
        Swal.fire("Error", "Please enter at least one IMEI number", "error");
        return;
    }
    
    var rowIndex = document.getElementById("mobileForm").getAttribute("data-row");
    
    try {
        if (rowIndex) {
            const res = await callAPI('updateMobileRecord', { rowIndex: parseInt(rowIndex), mobile });
            Swal.fire("Success", res, "success");
            document.getElementById("mobileForm").removeAttribute("data-row");
        } else {
            const res = await callAPI('addMobile', { mobile });
            Swal.fire("Success", res, "success");
            
            // Refresh set names
            const sets = await callAPI('getSetNames');
            var options = "<option value=''>Select Set</option>";
            sets.forEach(function(s) { 
                options += "<option value='" + s + "'>" + s + "</option>"; 
            });
            document.getElementById("setNameDropdown").innerHTML = options;
        }
        
        closeAddMobileModal();
        showStock();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

async function showStock() {
    document.getElementById("invoiceForm").style.display = "none";
    document.getElementById("historySection").style.display = "none";
    document.getElementById("imeiStockSection").style.display = "none";
    
    try {
        const mobiles = await callAPI('getAllMobiles');
        mobilesData = mobiles;
        renderStock(mobilesData);
        document.getElementById("stockSection").style.display = "block";
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

function closeStock() {
    document.getElementById("stockSection").style.display = "none";
    document.getElementById("invoiceForm").style.display = "block";
}

function renderStock(mobiles) {
    var searchQuery = document.getElementById("stockSearchInput").value.toLowerCase();
    var container = document.getElementById("stockContainer");
    container.innerHTML = "";
    mobiles.forEach(function (m) {
        var searchTarget = (m.setName + " " + m.variant).toLowerCase();
        if (searchTarget.indexOf(searchQuery) !== -1) {
            var div = document.createElement("div");
            div.className = "border p-4 rounded mb-2 flex items-center justify-between bg-gray-100";
            div.innerHTML = `
                <div>
                    <span class="font-bold">📱 ${m.setName}</span> - ${m.variant} <br>
                    Price: ₹${m.price} | Stock: ${m.stock} units<br>
                    <small class="text-gray-600">Based on IMEI count</small>
                </div>
                <div class="space-x-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-2 rounded" onclick="editMobile(${m.rowIndex},'${m.setName}','${m.variant}',${m.price})">Edit</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded" onclick="deleteMobileRecord(${m.rowIndex})">Delete</button>
                </div>
            `;
            container.appendChild(div);
        }
    });
}

function filterStock() {
    renderStock(mobilesData);
}

async function editMobile(rowIndex, setName, variant, price) {
    document.getElementById("adminModal").style.display = "flex";
    document.getElementById("mobileSetName").value = setName;
    document.getElementById("mobileVariant").value = variant;
    document.getElementById("mobilePrice").value = price;
    document.getElementById("mobileForm").setAttribute("data-row", rowIndex);
    
    try {
        const imeis = await callAPI('getAvailableImeis', { setName, variant });
        document.getElementById("mobileImeis").value = imeis.join('\n');
    } catch (err) {
        console.error('Error loading IMEIs:', err);
    }
}

async function deleteMobileRecord(rowIndex) {
    if (confirm("Are you sure you want to delete this mobile record?")) {
        try {
            const res = await callAPI('deleteMobile', { rowIndex });
            Swal.fire("Deleted", res, "success");
            showStock();
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        }
    }
}

// ========================================
// IMEI STOCK FUNCTIONS
// ========================================
async function showImeiStock() {
    document.getElementById("invoiceForm").style.display = "none";
    document.getElementById("historySection").style.display = "none";
    document.getElementById("stockSection").style.display = "none";
    
    try {
        const imeiData = await callAPI('getAllImeiStock');
        imeiStockData = imeiData;
        renderImeiStock(imeiStockData);
        document.getElementById("imeiStockSection").style.display = "block";
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

function closeImeiStock() {
    document.getElementById("imeiStockSection").style.display = "none";
    document.getElementById("invoiceForm").style.display = "block";
}

function renderImeiStock(imeiData) {
    if ($.fn.DataTable.isDataTable("#imeiStockTable")) {
        $("#imeiStockTable").DataTable().clear().destroy();
    }
    var tbody = document.querySelector("#imeiStockTable tbody");
    tbody.innerHTML = "";
    imeiData.forEach(function (row) {
        var tr = document.createElement("tr");
        var statusClass = row.status === "AVAILABLE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
        tr.innerHTML = `
            <td>${row.setName}</td>
            <td>${row.variant}</td>
            <td><code>${row.imei}</code></td>
            <td><span class="px-2 py-1 rounded text-xs font-bold ${statusClass}">${row.status}</span></td>
            <td>${row.dateAdded}</td>
        `;
        tbody.appendChild(tr);
    });
    $("#imeiStockTable").DataTable({ 
        responsive: true, 
        autoWidth: false, 
        width: "100%",
        pageLength: 25
    });
}

function filterImeiStock() {
    var searchQuery = document.getElementById("imeiSearchInput").value.toLowerCase();
    var table = $("#imeiStockTable").DataTable();
    table.search(searchQuery).draw();
}