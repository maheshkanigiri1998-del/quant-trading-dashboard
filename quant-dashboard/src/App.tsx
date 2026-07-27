import SwarmCard from './SwarmCard';
import LiveTicker from './LiveTicker';

function App() {
  return (
    <div
      style={{
        padding: '16px',
        paddingBottom: '40px',
        backgroundColor: '#121212',
        minHeight: '100vh',
        boxSizing: 'border-box',
        color: '#fff',
        maxWidth: '480px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <h1 style={{ fontSize: '1.35rem', margin: '0 0 6px 0', lineHeight: 1.3 }}>
        Quantitative Proof-of-Competence
      </h1>
      <p style={{ color: '#888', marginBottom: '20px', fontSize: '0.9rem' }}>
        Live market dashboard — works on phone and desktop
      </p>

      <LiveTicker />
      <SwarmCard />
    </div>
  );
}

export default App;
