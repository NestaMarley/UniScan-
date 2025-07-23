import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

// --- Theme ---
const COLORS = {
  primary: '#1E1E2C',
  accent: '#FFD600',
  success: '#00C853',
  error: '#D32F2F',
  background: '#FAFAFA',
  text: '#1E1E2C',
};

// --- Bold Button ---
function BoldButton({ title, onPress, color = COLORS.accent }) {
  return (
    <TouchableOpacity style={[styles.button, {backgroundColor: color}]} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

// --- Screens ---
function LoginScreen({ onLogin, onNavigateRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        onLogin(data.token, data.role, data.userId);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>UniScan</Text>
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BoldButton title="Log In" onPress={handleLogin} />
      <Text style={{ color: COLORS.primary, marginTop: 16 }} onPress={onNavigateRegister}>
        New here? Register
      </Text>
    </View>
  );
}

function RegisterScreen({ onNavigateLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async () => {
    try {
      const res = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (data.message) {
        setSuccess('Registered! Please login.');
        setTimeout(onNavigateLogin, 1500);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Role (student/admin)" value={role} onChangeText={setRole} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <BoldButton title="Register" onPress={handleRegister} />
      <Text style={{ color: COLORS.primary, marginTop: 16 }} onPress={onNavigateLogin}>
        Already registered? Log In
      </Text>
    </View>
  );
}

function ScanScreen({ token, userId, onNavigateHistory }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    try {
      const res = await fetch('http://localhost:3000/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ qrCodeData: data }),
      });
      const resData = await res.json();
      if (resData.message) {
        setMessage(`Success: ${resData.message}`);
      } else {
        setMessage(`Error: ${resData.error}`);
      }
    } catch (err) {
      setMessage('Network error');
    }
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Scan Your Attendance QR Code</Text>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={styles.scanner}
      />
      {scanned && (
        <Button title={'Tap to Scan Again'} onPress={() => { setScanned(false); setMessage(''); }} color={COLORS.accent} />
      )}
      {message ? <Text style={message.startsWith('Success') ? styles.success : styles.error}>{message}</Text> : null}
      <Button title="View Attendance History" onPress={onNavigateHistory} color={COLORS.primary} />
    </View>
  );
}

function AttendanceHistoryScreen({ token, userId, onNavigateScan }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://localhost:3000/attendance/${userId}`, {
          headers: { 'Authorization': token },
        });
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        setError('Failed to load attendance history');
      }
    };
    fetchHistory();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Attendance History</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={history}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={styles.record}>
            <Text style={styles.date}>{new Date(item.timestamp).toLocaleString()}</Text>
            <Text style={styles.qr}>{item.qrCodeData}</Text>
          </View>
        )}
      />
      <Button title="Back to Scan" onPress={onNavigateScan} color={COLORS.accent} />
    </View>
  );
}

// --- Navigation Logic ---
export default function App() {
  const [screen, setScreen] = useState('login');
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');

  const handleLogin = (tokenValue, roleValue, userIdValue) => {
    setToken(tokenValue);
    setRole(roleValue);
    setUserId(userIdValue);
    setScreen('scan');
  };

  return (
    <>
      {screen === 'login' && (
        <LoginScreen
          onLogin={handleLogin}
          onNavigateRegister={() => setScreen('register')}
        />
      )}
      {screen === 'register' && (
        <RegisterScreen
          onNavigateLogin={() => setScreen('login')}
        />
      )}
      {screen === 'scan' && (
        <ScanScreen
          token={token}
          userId={userId}
          onNavigateHistory={() => setScreen('history')}
        />
      )}
      {screen === 'history' && (
        <AttendanceHistoryScreen
          token={token}
          userId={userId}
          onNavigateScan={() => setScreen('scan')}
        />
      )}
    </>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary, marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#fff', width: '80%', padding: 12, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: COLORS.primary },
  button: { padding: 14, borderRadius: 8, width: '80%', alignItems: 'center', marginTop: 16 },
  buttonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  error: { color: COLORS.error, marginTop: 10 },
  success: { color: COLORS.success, marginTop: 10 },
  scanner: { width: '90%', height: 350, borderRadius: 12, borderWidth: 2, borderColor: COLORS.accent },
  record: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: COLORS.accent, width: '100%' },
  date: { color: COLORS.primary, fontWeight: 'bold' },
  qr: { color: COLORS.text }
});
