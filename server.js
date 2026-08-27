const express = require('express');
const sql = require('mssql');
const path = require('path');
const app = express();

app.use(express.json());

// 1. SERVE STATIC FILES (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

const config = {
    user: 'sa',
    password: '12345678', 
    server: 'localhost',
    database: 'Inventory_management_system', 
    options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: 'SQLEXPRESS' 
    },
    port: 1433
};

// 2. CONNECT TO SQL SERVER
sql.connect(config).then(() => {
    console.log("Connected to MS SQL Server successfully!");
}).catch(err => {
    console.log("Database connection failed: ", err);
});

// --- AUTHENTICATION ---
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, empId } = req.body;
        const validIDs = ["emp012004", "emp022004", "emp032004", "emp042004"];
        if (!validIDs.includes(empId)) {
            return res.json({ success: false, message: "Invalid Employee ID" });
        }

        let pool = await sql.connect(config);
        await pool.request()
            .input('name', sql.VarChar, name)
            .input('email', sql.VarChar, email)
            .input('pass', sql.VarChar, password)
            .input('eid', sql.VarChar, empId)
            .query("INSERT INTO Register_data (FullName, Email, Password, EmployeeID) VALUES (@name, @email, @pass, @eid)");
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Email already exists or DB error" });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        let pool = await sql.connect(config);
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('pass', sql.VarChar, password)
            .query("SELECT * FROM Register_data WHERE Email = @email AND Password = @pass");

        if (result.recordset.length > 0) res.json({ success: true });
        else res.json({ success: false, message: "Invalid credentials" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- PRODUCT MANAGEMENT (CRUD) ---

// Get All Products for Repository
app.get('/get-products', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query("SELECT * FROM products ORDER BY productName ASC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add New Product from Warehouse Intake
app.post('/add-product', async (req, res) => {
    try {
        const { code, name, line, vendor, desc, stock, price, msrp } = req.body;
        let pool = await sql.connect(config);
        
        await pool.request()
            .input('code', sql.VarChar, code)
            .input('name', sql.VarChar, name)
            .input('line', sql.VarChar, line)
            .input('vendor', sql.VarChar, vendor)
            .input('desc', sql.Text, desc) // Handles the Product Description
            .input('stock', sql.Int, stock)
            .input('price', sql.Decimal(10, 2), price)
            .input('msrp', sql.Decimal(10, 2), msrp)
            .query(`INSERT INTO products (productCode, productName, productLine, productVendor, productDescription, quantityInStock, buyPrice, MSRP) 
                    VALUES (@code, @name, @line, @vendor, @desc, @stock, @price, @msrp)`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Product from Edit Modal
app.put('/update-product', async (req, res) => {
    try {
        const { code, name, line, vendor, desc, stock, price, msrp } = req.body;
        let pool = await sql.connect(config);
        await pool.request()
            .input('code', sql.VarChar, code)
            .input('name', sql.VarChar, name)
            .input('line', sql.VarChar, line)
            .input('vendor', sql.VarChar, vendor)
            .input('desc', sql.Text, desc)
            .input('stock', sql.Int, stock)
            .input('price', sql.Decimal(10, 2), price)
            .input('msrp', sql.Decimal(10, 2), msrp)
            .query(`UPDATE products SET 
                        productName=@name, 
                        productLine=@line, 
                        productVendor=@vendor, 
                        productDescription=@desc, 
                        quantityInStock=@stock, 
                        buyPrice=@price, 
                        MSRP=@msrp 
                    WHERE productCode=@code`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete Product
app.delete('/delete-product/:code', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        await pool.request()
            .input('code', sql.VarChar, req.params.code)
            .query("DELETE FROM products WHERE productCode=@code");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- DASHBOARD ANALYTICS ---

app.get('/get-realtime-stats', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        
        // Logical Summations for Capacity, Velocity, and Active Sellers
        const result = await pool.request().query(`
            SELECT 
                (SELECT SUM(quantityInStock) FROM products) as totalInStock,
                (SELECT SUM(quantityOrdered) FROM [Order details]) as totalSold,
                (SELECT COUNT(firstName) FROM employees) as totalEmployees
        `);

        const { totalInStock, totalSold, totalEmployees } = result.recordset[0];

        // Formula 1: Capacity = ((SUM Stock / 1,000,000) * 100)
        const capacity = (( (totalInStock || 0) / 1000000) * 100).toFixed(2);

        // Formula 2: Stock Velocity % = (Total Sold / Total In Stock) * 100
        const velocityPct = (( (totalSold || 0) / (totalInStock || 1)) * 100).toFixed(2);

        // Formula 3: Active Sellers = Count of firstName
        const activeSellers = totalEmployees || 0;

        res.json({
            capacity: capacity + "%",
            velocity: velocityPct + "%",
            sellers: activeSellers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));