import React, { useState } from 'react';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import Button from '@/components/ui/Button';

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
                    <Button onClick={() => setActiveTab('template')} variant={activeTab === 'template' ? 'primary' : 'sad'}>template.kml</Button>
                    <Button onClick={() => setActiveTab('waylines')} variant={activeTab === 'template' ? 'sad' : 'primary'}>waylines.wpml</Button>
                </div>

                <div>
                    <Button onClick={() => navigator.clipboard.writeText(activeXml)} variant='success'>Copy XML</Button>
                    <Button onClick={onClose} variant='danger'>Close</Button>
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