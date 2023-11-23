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
const crypto = require('crypto');
const admin = require('firebase-admin');

const userSockets = {};
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

const serviceAccount = require('/Users/jeremiahvelasco/Ruta-Backend/ruta-7c85f-firebase-adminsdk-4xpeh-9b412e70cf.json'); // Replace with your actual path
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ruta-7c85f.firebaseio.com', // Replace with your Firebase project URL
});

//GET DRIVER DETAILS
app.get('/api/driver/:uid', (req, res) => {
  const uid = req.params.uid;

  if (!uid) {
    return res.status(400).json({ error: 'Invalid request data: Missing UID' });
  }

  // Use a parameterized query to avoid SQL injection
  const sql = 'SELECT * FROM drivers WHERE uid = ?';
  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = results[0];
    // Assuming you want to send only specific details, not all columns
    const { uid, name, contact } = driver;
    res.json({ uid, name, contact });
  });
});

  
// PASSENGER APP - USER REGISTER
app.post('/api/users', (req, res) => {
  const { uid, name, contact, email } = req.body;
  db.query('INSERT INTO users (uid, name, contact, email) VALUES (?, ?, ?, ?)', [uid, name, contact, email], (err, results) => {
    if (err) throw err;
    res.json({ message: 'User added successfully' });
  });
});

// DRIVER APP - DRIVER REGISTER
app.post('/api/drivers', (req, res) => {
  const { uid, name, contact, email } = req.body;
  db.query('INSERT INTO drivers (uid, name, contact, email) VALUES (?, ?, ?, ?)', [uid, name, contact, email], (err, results) => {
    if (err) throw err;
    res.json({ message: 'Driver added successfully' });
  });
});

//BOOKING
app.post('/book', (req, res) => {
    const {bookingId, origin, destination, passenger, title, distance} = req.body;
    const { uid, name, contact} = passenger;
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
  
    let fare = fareBaseFee;
    if (distance > 1) {
      // If distance is greater than 0.5 km, calculate additional fee
      const additionalHalfKm = Math.ceil((distance - 0.5) * 1); // Round up to the nearest half km after the first 0.5 km
      fare += additionalHalfKm * fareAdditionalFeePerHalfKm;
    }

    let totalFee = pickUpFee + fare;

    console.log("Booking ID:", bookingId);
    console.log("UID:", uid);
    console.log("Origin:", origin);
    console.log("Destination:", destination);
    console.log("Distance from Terminal to Origin:", distanceToTerminal,"meters");
    console.log("Pick-Up Fee:","Php",pickUpFee);
    console.log("Distance:", distance, "km");
    console.log("Fare:","Php",fare);
    console.log("Total:","Php",totalFee);
    console.log("Name:", name);
    console.log("Contact:", contact);

    io.emit('locationUpdate', { bookingId, uid, origin, destination, name, contact, title, distance, distanceToTerminal, pickUpFee, fare, totalFee });
    res.status(200).send("Location booked successfully");
});

const hash = (data) => {
  const hash = crypto.createHash('sha256'); // You can use other algorithms like md5, sha1, etc.
  hash.update(data);
  return hash.digest('hex');
};



// WEBSOCKET CONNECTION
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.use(async (packet, next) => {
    try {
      const [event, data] = packet;
      
      if (event === 'user_login' && data.idToken) {
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(data.idToken);

        // Associate UID with socket connection
        const uid = decodedToken.uid;
        userSockets[uid] = socket;
        console.log(`User ${uid} connected`);
      }

      next();
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
    }
  });


  //ACCEPTED BOOKING
  socket.on('accept_booking', ({ driverId, bookingId, data }) => {

    const {uid, status} = data;

    // Notify the passenger about the booking status change
    const passengerRoomId = hash(bookingId);
    const passengerSocket = userSockets[data.uid]; 

    if (passengerSocket) {
      // Emit the 'booking_update' event to the passenger
      passengerSocket.emit('booking_update', {
        bookingId,
        status: 'Accepted',
        driverId,
      });
    }
    console.log(`SERVER - Driver: ${driverId}`);
    console.log(`SERVER - Passenger Room ID: ${passengerRoomId}`);
    console.log(`SERVER - Booking ID: ${bookingId}`);
    console.log(`SERVER - Status: ${status}`);
  });

  //SUCCESSFUL BOOKING - PASSENGER DROPPED
  socket.on('success_booking', ({ bookingId }) => {
    // Implement the logic to handle booking confirmation
    // Update the database with the confirmed booking information

    // Notify the passenger about the booking status change
    const passengerRoomId = hash(bookingId);
    io.to(passengerRoomId).emit('booking_update', {
      bookingId,
      status: 'Accepted',
      uid,
    });
  });

  //SKIPPED BOOKING
  socket.on('skip_booking', ({ driverId, bookingId, data }) => {

    const {uid, status} = data;

    // Notify the passenger about the booking status change
    const passengerSocket = userSockets[data.uid]; 

    if (passengerSocket) {
      // Emit the 'booking_update' event to the passenger
      passengerSocket.emit('booking_update', {
        bookingId,
        status: 'Rejected',
        driverId,
      });
    }
    const passengerRoomId = hash(bookingId);
    io.to(passengerRoomId).emit('booking_update', {
      bookingId,
      status: 'Rejected',
    });
    console.log(`SERVER - Driver: ${driverId}`);
    console.log(`SERVER - Passenger Room ID: ${passengerRoomId}`);
    console.log(`SERVER - Booking ID: ${bookingId}`);
    console.log(`SERVER - Status: ${status}`);
  });


  // Disconnect event
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    // Additional cleanup or handling when a user disconnects
  });
});

// Your existing server code
server.listen(port, () => {
  console.log("Server is running on port: " + port);
});


