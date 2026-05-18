import SwarmCard from './SwarmCard';
import LiveTicker from './LiveTicker';
import { AiAuditCard } from './AiAuditCard';

function App() {
  return (
    <div style={{ padding: '50px', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1>Quantitative Proof-of-Competence</h1>
      <p style={{ color: '#888', marginBottom: '30px' }}>React Dashboard</p>
      
      <SwarmCard />
      <AiAuditCard />
      <LiveTicker />
      
    </div>
  );
}

export default App;