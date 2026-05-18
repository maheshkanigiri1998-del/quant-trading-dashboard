import React, { useState } from 'react';

export const AiAuditCard = () => {
  const [terminalText, setTerminalText] = useState("> Agent on standby.");
  const [isAuditing, setIsAuditing] = useState(false);

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setTerminalText("> Initializing secure connection...\n> Agent 1 searching the web...\n> Agent 2 analyzing data...");

    try {
        const response = await fetch('http://127.0.0.1:8000/api/run-news-audit');
        const data = await response.json();
        setTerminalText(`> AUDIT COMPLETE\n\n${data.output}`);
    } catch (error) {
        setTerminalText("> ERROR: Backend connection failed. Is Python running?");
    } finally {
        setIsAuditing(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', color: 'white', fontFamily: 'monospace', width: '100%', maxWidth: '600px', margin: '20px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#a8b2d1' }}>AI FINANCIAL AUDIT</h3>
            <button 
                onClick={handleRunAudit} 
                disabled={isAuditing}
                style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: isAuditing ? 'wait' : 'pointer' }}
            >
                {isAuditing ? 'RUNNING...' : 'RUN AUDIT'}
            </button>
        </div>
        
        <div style={{ backgroundColor: '#000000', padding: '15px', borderRadius: '4px', minHeight: '120px', whiteSpace: 'pre-wrap', color: '#10b981', border: '1px solid #333' }}>
            {terminalText}
        </div>
    </div>
  );
};