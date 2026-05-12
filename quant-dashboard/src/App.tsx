import LiveTicker from './LiveTicker';

function App() {
  return (
    <div style={{ padding: '50px', backgroundColor: '#121212', minHeight: '100vh', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <h1>Quantitative Proof-of-Competence</h1>
      <p style={{ color: '#888', marginBottom: '30px' }}>Real-time Data Pipeline Visualization</p>
      
      <LiveTicker />
    </div>
  );
}

export default App;