import React from 'react';
import { CONFIG } from '../config';
import { Server, Database, Key, Globe, Shield, Terminal, Settings } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const ConfigItem = ({ label, value, icon: Icon, blur = false }: any) => (
    <div className="flex flex-col p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gray-100 rounded-lg text-sycapt-gray">
                <Icon size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
        </div>
        {blur && <span className="text-[10px] bg-red-50 text-sycapt-red px-2 py-0.5 rounded-full font-bold">SECRET</span>}
      </div>
      <code className={`font-mono text-sm text-sycapt-dark bg-gray-50/50 p-2 rounded-lg border border-gray-100 break-all ${blur ? 'blur-[4px] hover:blur-none transition-all duration-300 cursor-help select-all' : 'select-all'}`}>
        {value}
      </code>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center space-x-4 mb-8">
          <div className="p-3 bg-sycapt-red rounded-xl shadow-lg shadow-red-500/20">
              <Settings className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-sycapt-dark">Configuration</h2>
            <p className="text-sycapt-gray">Environment variables and connection strings.</p>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Section: AI Model */}
        <section>
            <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-gray-100">
                <Terminal className="text-sycapt-red" size={20}/> 
                <h3 className="text-lg font-bold text-gray-900">Inference Engine</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ConfigItem label="Model Name" value={CONFIG.OLLAMA.MODEL} icon={Server} />
                <ConfigItem label="API Endpoint" value={CONFIG.OLLAMA.BASE_URL} icon={Globe} />
            </div>
        </section>

        {/* Section: Database */}
        <section>
            <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-gray-100">
                <Database className="text-sycapt-red" size={20}/> 
                <h3 className="text-lg font-bold text-gray-900">Vector Storage</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ConfigItem label="Host IP" value={CONFIG.DB.HOST} icon={Server} />
                <ConfigItem label="Port" value={CONFIG.DB.PORT} icon={Globe} />
                <ConfigItem label="Database Name" value={CONFIG.DB.NAME} icon={Database} />
                <ConfigItem label="User" value={CONFIG.DB.USER} icon={Shield} />
                <div className="lg:col-span-2">
                    <ConfigItem label="Password" value="ปิดไว้นะจ๊ะ" icon={Key} blur={true} />
                </div>
            </div>
        </section>
      </div>
      
      <div className="mt-8 bg-amber-50 border border-amber-200 p-5 rounded-xl flex items-start space-x-4">
          <div className="flex-shrink-0 mt-0.5">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-sm text-amber-800">
            <p className="font-bold mb-1">Security Notice</p>
            <p className="leading-relaxed opacity-90">
              This interface demonstrates client-side configuration display. In a production environment, 
              direct database credentials should <strong>never</strong> be exposed to the client. 
              All requests should be routed through a secured middleware API.
            </p>
          </div>
      </div>
    </div>
  );
};