import React, { useState } from 'react';
import { AppView } from '../../types';
import { LogIn, Mail, Lock, AlertCircle, ArrowRight, Search, ShieldCheck, MessageSquare } from 'lucide-react';
import { Logo } from './Logo';
const bgLogin = new URL('../../../images/background/cyber1.691Z.png', import.meta.url).href;



interface LoginViewProps {
    onSuccess: (userData: any) => void;
    onSwitchToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store token in local storage
            localStorage.setItem('sycapt_token', data.token);
            localStorage.setItem('sycapt_user', JSON.stringify(data.user));

            onSuccess(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat relative p-4 md:p-8"
            style={{ backgroundImage: `url(${bgLogin})` }}>
            {/* Dark Overlay for better contrast */}
            <div className="absolute inset-0 bg-sycapt-dark/60 backdrop-blur-[2px]"></div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-[2.5rem] shadow-2xl relative z-10 border border-white/10">

                {/* Left Side: System Information (Informational) */}
                <div className="lg:col-span-7 bg-sycapt-dark/40 backdrop-blur-xl p-8 md:p-12 text-white flex flex-col justify-center border-r border-white/5">
                    <div className="space-y-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sycapt-red/20 border border-sycapt-red/30 text-sycapt-red text-xs font-bold uppercase tracking-widest mb-4">
                                Version 2.0 • Enterprise AI
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                                Intelligence <br />
                                <span className="text-sycapt-red">Document Graph</span>
                            </h1>
                            <p className="mt-6 text-lg text-white/70 max-w-md leading-relaxed">
                                ปฏิวัติการจัดการความรู้ในองค์กรด้วยระบบ AI ที่ไม่ได้มีแค่การค้นหา แต่คือการเชื่อมโยงข้อมูลทุกอย่างเข้าด้วยกัน
                            </p>
                        </div>

                        {/* Feature Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 group">
                                <div className="p-3 w-fit rounded-xl bg-white/5 border border-white/10 group-hover:bg-sycapt-red/20 group-hover:border-sycapt-red/30 transition-all">
                                    <Search className="text-sycapt-red" size={24} />
                                </div>
                                <h3 className="font-bold text-lg">Semantic Search</h3>
                                <p className="text-sm text-white/50">ค้นหาด้วย "ความหมาย" ไม่ใช่แค่คีย์เวิร์ด รองรับการค้นจากรูปภาพและไฟล์แนบ</p>
                            </div>
                            <div className="space-y-2 group">
                                <div className="p-3 w-fit rounded-xl bg-white/5 border border-white/10 group-hover:bg-sycapt-red/20 group-hover:border-sycapt-red/30 transition-all">
                                    <ShieldCheck className="text-sycapt-red" size={24} />
                                </div>
                                <h3 className="font-bold text-lg">Hybrid Ingestion</h3>
                                <p className="text-sm text-white/50">เชื่อมต่อข้อมูลอัตโนมัติจาก N8N, Email และระบบเดิมของคุณอย่างไร้รอยต่อ</p>
                            </div>
                            <div className="space-y-2 group">
                                <div className="p-3 w-fit rounded-xl bg-white/5 border border-white/10 group-hover:bg-sycapt-red/20 group-hover:border-sycapt-red/30 transition-all">
                                    <MessageSquare className="text-sycapt-red" size={24} />
                                </div>
                                <h3 className="font-bold text-lg">AI Vision & OCR</h3>
                                <p className="text-sm text-white/50">แกะข้อความจากรูปภาพ แผนผัง และ PDF สแกน ด้วยเทคโนโลยี Vision AI ล่าสุด</p>
                            </div>
                            <div className="space-y-2 group">
                                <div className="p-3 w-fit rounded-xl bg-white/5 border border-white/10 group-hover:bg-sycapt-red/20 group-hover:border-sycapt-red/30 transition-all">
                                    <Lock className="text-sycapt-red" size={24} />
                                </div>
                                <h3 className="font-bold text-lg">Graph Architecture</h3>
                                <p className="text-sm text-white/50">จัดเก็บข้อมูลแบบ Universal Content Graph เพื่อความสัมพันธ์ที่ลึกซึ้งของเนื่อหา</p>
                            </div>
                        </div>

                        {/* Tech Stack Info */}
                        <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4 items-center">
                            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Built with:</span>
                            <div className="flex gap-3">
                                <span className="bg-white/5 px-3 py-1 rounded text-[10px] font-mono border border-white/10">Node.js</span>
                                <span className="bg-white/5 px-3 py-1 rounded text-[10px] font-mono border border-white/10">pgvector</span>
                                <span className="bg-white/5 px-3 py-1 rounded text-[10px] font-mono border border-white/10">Ollama API</span>
                                <span className="bg-white/5 px-3 py-1 rounded text-[10px] font-mono border border-white/10">BGE-M3</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="lg:col-span-5 bg-white/95 backdrop-blur-md flex flex-col">
                    <div className="bg-sycapt-red p-8 text-white relative overflow-hidden flex flex-col items-center">
                        <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                        <div className="bg-white p-3 rounded-2xl shadow-xl mb-6 transform transition-transform hover:scale-110">
                            <Logo className="h-10" />
                        </div>

                        <h2 className="text-2xl font-bold">Welcome Back</h2>
                        <p className="mt-1 text-white/70 text-sm">Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-6 flex-grow">
                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={20} />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="relative group">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block transition-colors group-focus-within:text-sycapt-red">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/10 outline-none transition-all placeholder:text-gray-300"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="relative group">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block transition-colors group-focus-within:text-sycapt-red">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/10 outline-none transition-all placeholder:text-gray-300"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-sycapt-red text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-sycapt-red/20 hover:bg-red-600 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 group"
                        >
                            {loading ? 'Authenticating...' : (
                                <>
                                    Sign In
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="pt-4 text-center">
                            <p className="text-gray-500 text-sm">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={onSwitchToRegister}
                                    className="text-sycapt-red font-bold hover:underline"
                                >
                                    Create Account
                                </button>
                            </p>
                        </div>
                    </form>

                    <div className="p-6 bg-gray-50 text-center border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">© 2026 Sycapt Co., Ltd. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

