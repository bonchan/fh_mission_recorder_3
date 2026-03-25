import React, { useState } from 'react';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';

export const XMLDebugModal = ({
    templateKml,
    waylinesWpml,
    onClose
}: {
    templateKml: string,
    waylinesWpml: string,
    onClose: () => void
}) => {
    const [activeTab, setActiveTab] = useState<'template' | 'waylines'>('template');

    if (!templateKml && !waylinesWpml) return null;

    const activeXml = activeTab === 'template' ? templateKml : waylinesWpml;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', padding: '40px'
        }}>
            {/* Header & Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                    <button
                        onClick={() => setActiveTab('template')}
                        style={{ padding: '8px 16px', background: activeTab === 'template' ? '#0066ff' : '#333', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px 0 0 4px' }}
                    >
                        template.kml
                    </button>
                    <button
                        onClick={() => setActiveTab('waylines')}
                        style={{ padding: '8px 16px', background: activeTab === 'waylines' ? '#0066ff' : '#333', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '0 4px 4px 0' }}
                    >
                        waylines.wpml
                    </button>
                </div>

                <div>
                    <button
                        onClick={() => navigator.clipboard.writeText(activeXml)}
                        style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px', marginRight: '10px' }}
                    >
                        Copy XML
                    </button>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* XML Display Area */}
            <div style={{ flex: 1, overflow: 'hidden', borderRadius: '8px', border: '1px solid #444' }}>
                <SyntaxHighlighter
                    language="xml"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, height: '100%', fontSize: '12px' }}
                    showLineNumbers={true}
                >
                    {activeXml}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};