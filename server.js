const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bodyparser = require('body-parser'); 
const geolib = require('geolib');
const app = express();
const port = 3000; // or any port you prefer
const server = http.createServer(app);
const io = socketIO(server);
const mysql = require('mysql2');



app.use(bodyparser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'rootadmin',
  database: 'ruta',
});

app.get('/', (req, res) => {
    res.send('Welcome to Ruta-Backend Server');
  });

//GET USER DETAILS
app.get('/api/user/:uid', (req, res) => {
  const uid = req.params.uid;
  
  if (!uid) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  
  // Use a parameterized query to avoid SQL injection
  db.query('SELECT * FROM users WHERE uid = ?', [uid], (err, results) => {
    if (err) {
      console.error('Error fetching user details:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
  
    const user = results[0]; // Assuming you want to send the first user found
    res.json(user);
  });
});

//GET DRIVER DETAILS
app.get('/api/driver/:uid', (req, res) => {
  const uid = req.params.uid;
  
  if (!uid) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  
  // Use a parameterized query to avoid SQL injection
  db.query('SELECT * FROM drivers WHERE uid = ?', [uid], (err, results) => {
    if (err) {
      console.error('Error fetching driver details:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  
    if (results.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
  
    const user = results[0]; // Assuming you want to send the first user found
    res.json(user);
  });
});
  
// PASSENGER APP - STORE REGISTERED 
app.post('/api/users', (req, res) => {
  const { uid, name, contact, email } = req.body;
  db.query('INSERT INTO users (uid, name, contact, email) VALUES (?, ?, ?, ?)', [uid, name, contact, email], (err, results) => {
    if (err) throw err;
    res.json({ message: 'User added successfully' });
  });
});

// DRIVER APP - STORE REGISTERED 
app.post('/api/drivers', (req, res) => {
  const { uid, name, contact, email } = req.body;
  db.query('INSERT INTO drivers (uid, name, contact, email) VALUES (?, ?, ?, ?)', [uid, name, contact, email], (err, results) => {
    if (err) throw err;
    res.json({ message: 'Driver added successfully' });
  });
});

//BOOKING
app.post('/book', (req, res) => {
    const {origin, destination, passenger, title, distance} = req.body;
    const {name, contact} = passenger;
    const terminal = {
      latitude: 14.686436,
      longitude: 121.064228,
    }

    const distanceToTerminal = geolib.getDistance(origin, terminal);

    // Calculate pickUpFee
    const baseFee = 10; // Php10 for the first km
    const additionalFeePerKm = 10; // Php10 for every additional km
    const distanceInKm = distanceToTerminal / 1000; // Convert distance to km

    let pickUpFee = baseFee;
    if (distanceInKm > 1) {
      // If distance is greater than 1 km, calculate additional fee
      const additionalKm = Math.ceil(distanceInKm) - 1; // Round up to the nearest km after the first km
      pickUpFee += additionalKm * additionalFeePerKm;
    }

    // Calculate fare
    const fareBaseFee = 10; // Php10 for the first km
    const fareAdditionalFeePerHalfKm = 5; // Php5 for every additional half km
    const fareDistance = distance; // Convert distance to km
  
    let fare = fareBaseFee;
    if (fareDistance > 1) {
      // If distance is greater than 0.5 km, calculate additional fee
      const additionalHalfKm = Math.ceil((fareDistance - 0.5) * 1); // Round up to the nearest half km after the first 0.5 km
      fare += additionalHalfKm * fareAdditionalFeePerHalfKm;
    }

    let totalFee = pickUpFee + fare;



    console.log("Origin:", origin);
    console.log("Destination:", destination);
    console.log("Distance from Terminal to Origin:", distanceToTerminal,"meters");
    console.log("Pick-Up Fee:","Php",pickUpFee);
    console.log("Distance:", distance, "km");
    console.log("Fare:","Php",fare);
    console.log("Total:","Php",totalFee);
    console.log("Name:", name);
    console.log("Contact:", contact);

    io.emit('locationUpdate', { origin, destination, name, contact, title, distance, distanceToTerminal, pickUpFee, fare, totalFee });
    res.status(200).send("Location booked successfully");
});



// WEBSOCKET CONNECTION
io.on('connection', (socket) => {
  console.log('A driver connected');

  // Additional socket event handling for other functionalities

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('A driver disconnected');
  });
});

server.listen(port, () => {
  console.log("Server is running on port: " + port);
});



