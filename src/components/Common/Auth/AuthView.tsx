import React, { useState } from 'react';
import {
    Mail, Lock, AlertCircle, ArrowRight, Search,
    ShieldCheck, MessageSquare, User, Building, Network,
    Database, Binary, Sparkles, ArrowDown, ArrowLeft, ChevronLeft
} from 'lucide-react';
import { Logo } from '../../Common/Logo';
const bgLogin = new URL('../../../images/background/cyber1.691Z.png', import.meta.url).href;

interface AuthViewProps {
    onSuccess: (userData: any) => void;
    initialMode?: 'login' | 'register';
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, initialMode = 'login' }) => {
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [department, setDepartment] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeStep, setActiveStep] = useState<number | null>(null);

    const ragSteps = [
        {
            id: 1,
            icon: Database,
            title: "1. Data Ingestion & Chunking",
            shortDesc: "นำเข้าและย่อยข้อมูล (Chunking)",
            detailTitle: "Intelligent Ingestion Pipeline",
            detailDesc: [
                "ระบบรองรับการนำเข้าข้อมูลจากหลากหลายแหล่ง (PDF, DOCX, Webhooks) และเข้าสู่กระบวนการ 'Semantic Chunking'",
                "เราไม่ได้แค่ตัดคำตามบรรทัด แต่เราวิเคราะห์บริบทเพื่อแบ่งข้อมูลออกเป็นชิ้นส่วนที่มีความหมายในตัวเอง (Meaningful Segments) พร้อมเก็บ Metadata สำคัญ เช่น ผู้แต่ง วันที่ และโปรเจกต์ เพื่อใช้ในการกรองข้อมูลในภายหลัง"
            ]
        },
        {
            id: 2,
            icon: Binary,
            title: "2. Vector Embedding",
            shortDesc: "แปลงข้อมูลเป็น Vector Math",
            detailTitle: "High-Dimensional Embedding",
            detailDesc: [
                "หัวใจของ AI คือการแปลงข้อความ รูปภาพ และตาราง ให้กลายเป็น 'Vector' หรือรหัสทางคณิตศาสตร์ความละเอียดสูง (1024+ dimensions)",
                "สิ่งนี้ทำให้ระบบสามารถคำนวณ 'ความเหมือนทางความหมาย' (Cosine Similarity) ได้อย่างแม่นยำ คอมพิวเตอร์จึงเข้าใจว่า 'บริษัท' และ 'องค์กร' มีความหมายใกล้เคียงกัน โดยไม่ต้องพึ่งพา Keyword Matching เพียงอย่างเดียว"
            ]
        },
        {
            id: 3,
            icon: Network,
            title: "3. Semantic Retrieval",
            shortDesc: "ค้นหาด้วยความหมาย",
            detailTitle: "Hybrid Search & Reranking",
            detailDesc: [
                "เพื่อความแม่นยำสูงสุด เราใช้ระบบ Hybrid Search ที่ผสานพลังของ Vector Search (ความหมาย) และ Full-Text Search (คำศัพท์เฉพาะ)",
                "ผลลัพธ์ที่ได้จะถูกส่งเข้าสู่โมเดล 'Reranker' เพื่อจัดลำดับความเกี่ยวข้องใหม่ ให้แน่ใจว่าข้อมูลที่สำคัญที่สุดถูกส่งต่อไปยัง AI เสมอ ลดโอกาสที่ AI จะได้รับข้อมูลขยะ"
            ]
        },
        {
            id: 4,
            icon: Sparkles,
            title: "4. AI Generation",
            shortDesc: "สรุปคำตอบจากข้อมูล",
            detailTitle: "Context-Aware Generation",
            detailDesc: [
                "ขั้นตอนสุดท้าย คือการนำข้อมูลที่คัดกรองแล้ว (Context) ส่งให้ Large Language Model (LLM) ประมวลผล",
                "AI จะตอบคำถามโดยอ้างอิงจากข้อมูลที่เราจัดหาให้เท่านั้น (Grounded Generation) ช่วยลดปัญหาการมั่วข้อมูล (Hallucination) และสามารถระบุแหล่งที่มาของคำตอบได้ถึงระดับหน้าเอกสาร"
            ]
        }
    ];

    const handleLogin = async (e: React.FormEvent) => {
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
            if (!response.ok) throw new Error(data.error || 'Login failed');
            localStorage.setItem('sycapt_token', data.token);
            localStorage.setItem('sycapt_user', JSON.stringify(data.user));
            onSuccess(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, department, role: 'user' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');
            setIsLogin(true);
            setError('Registration successful! Please login.');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat relative p-4 overflow-hidden select-none"
            style={{ backgroundImage: `url(${bgLogin})`, backgroundAttachment: 'fixed' }}>

            {/* Dark Filter Layer */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

            {/* Main Container - Adjusted Size */}
            <div className="relative w-full max-w-6xl h-[700px] flex rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 bg-sycapt-dark/40 backdrop-blur-xl transition-all duration-300">

                {/* Left Info Area (Visible when Login) - EDUCATIONAL RAG CONTENT */}
                <div className={`absolute left-0 top-0 w-3/5 h-full p-12 md:p-14 flex flex-col justify-center transition-all duration-1000 ease-in-out ${isLogin ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}`}>

                    {/* OVERVIEW MODE */}
                    <div className={`transition-all duration-500 absolute inset-0 p-14 flex flex-col justify-center ${activeStep === null ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0 pointer-events-none'}`}>
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-sycapt-red/10 border border-sycapt-red/30 text-sycapt-red text-[10px] font-bold uppercase tracking-[0.2em]">
                                Advanced Vector RAG Architecture
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-4xl font-black text-white leading-tight">
                                    How Sycapt <br />
                                    <span className="text-sycapt-red">Processes Intelligence?</span>
                                </h2>
                                <p className="text-sm text-white/50 leading-relaxed max-w-lg">
                                    เรียนรู้กระบวนการทำงานของระบบ <strong>RAG (Retrieval-Augmented Generation)</strong> ที่เปลี่ยนเอกสารธรรมดาให้กลายเป็นฐานความรู้อัจฉริยะประมวลผลด้วย AI
                                </p>
                            </div>

                            <div className="relative mt-2">
                                {/* Snake Layout Grid */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-8 relative z-10">

                                    {/* Step 1: Ingestion (Top Left) */}
                                    <div className="relative group cursor-pointer" onClick={() => setActiveStep(1)}>
                                        <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group-hover:bg-sycapt-red/10 group-hover:border-sycapt-red/30 transition-all h-full items-start">
                                            <div className="p-2 bg-white/5 rounded-lg text-sycapt-red shrink-0 group-hover:scale-110 transition-transform">
                                                <Database size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-xs mb-1 group-hover:text-sycapt-red transition-colors">1. Ingestion</h4>
                                                <p className="text-[9px] text-white/40 leading-relaxed group-hover:text-white/60">นำเข้าและย่อยข้อมูล (Chunking)</p>
                                            </div>
                                        </div>
                                        {/* Arrow 1->2 */}
                                        <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-white/20 animate-pulse">
                                            <ArrowRight size={16} />
                                        </div>
                                    </div>

                                    {/* Step 2: Embedding (Top Right) */}
                                    <div className="relative group cursor-pointer" onClick={() => setActiveStep(2)}>
                                        <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group-hover:bg-sycapt-red/10 group-hover:border-sycapt-red/30 transition-all h-full items-start">
                                            <div className="p-2 bg-white/5 rounded-lg text-sycapt-red shrink-0 group-hover:scale-110 transition-transform">
                                                <Binary size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-xs mb-1 group-hover:text-sycapt-red transition-colors">2. Embedding</h4>
                                                <p className="text-[9px] text-white/40 leading-relaxed group-hover:text-white/60">แปลงข้อมูลเป็น Vector Math</p>
                                            </div>
                                        </div>
                                        {/* Arrow 2->3 (Down) */}
                                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-white/20 animate-pulse">
                                            <ArrowDown size={16} />
                                        </div>
                                    </div>

                                    {/* Step 4: Generation (Bottom Left) - VISUAL ORDER 4th */}
                                    <div className="relative group cursor-pointer" onClick={() => setActiveStep(4)}>
                                        <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group-hover:bg-sycapt-red/10 group-hover:border-sycapt-red/30 transition-all h-full items-start">
                                            <div className="p-2 bg-white/5 rounded-lg text-sycapt-red shrink-0 group-hover:scale-110 transition-transform">
                                                <Sparkles size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-xs mb-1 group-hover:text-sycapt-red transition-colors">4. AI Generation</h4>
                                                <p className="text-[9px] text-white/40 leading-relaxed group-hover:text-white/60">สรุปคำตอบจากข้อมูล</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3: Retrieval (Bottom Right) - VISUAL ORDER 3rd */}
                                    <div className="relative group cursor-pointer" onClick={() => setActiveStep(3)}>
                                        <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group-hover:bg-sycapt-red/10 group-hover:border-sycapt-red/30 transition-all h-full items-start">
                                            <div className="p-2 bg-white/5 rounded-lg text-sycapt-red shrink-0 group-hover:scale-110 transition-transform">
                                                <Network size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-xs mb-1 group-hover:text-sycapt-red transition-colors">3. Retrieval</h4>
                                                <p className="text-[9px] text-white/40 leading-relaxed group-hover:text-white/60">ค้นหาด้วยความหมาย</p>
                                            </div>
                                        </div>
                                        {/* Arrow 3->4 (Left) */}
                                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-white/20 animate-pulse">
                                            <ArrowLeft size={16} />
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DETAIL MODE */}
                    {ragSteps.map((step) => (
                        <div key={step.id}
                            className={`transition-all duration-500 absolute inset-0 p-14 flex flex-col justify-center ${activeStep === step.id ? 'opacity-100 scale-100 z-20' : 'opacity-0 scale-95 z-0 pointer-events-none'}`}>

                            <button onClick={() => setActiveStep(null)} className="group flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors width-fit">
                                <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/5">
                                    <ChevronLeft size={14} />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Back to Process</span>
                            </button>

                            <div className="space-y-6">
                                <div className="w-16 h-16 rounded-2xl bg-sycapt-red/10 border border-sycapt-red/20 flex items-center justify-center text-sycapt-red shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                                    <step.icon size={32} />
                                </div>

                                <div>
                                    <div className="text-sycapt-red font-black text-sm uppercase tracking-widest mb-2">Step 0{step.id}</div>
                                    <h2 className="text-3xl font-black text-white mb-4">{step.detailTitle}</h2>
                                    <div className="space-y-4">
                                        {step.detailDesc.map((desc, i) => (
                                            <p key={i} className="text-sm text-white/60 leading-relaxed">
                                                {desc}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Info Area (Visible when Register) */}
                <div className={`absolute right-0 top-0 w-3/5 h-full p-12 md:p-14 flex flex-col justify-center items-end transition-all duration-1000 ease-in-out ${!isLogin ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}>
                    <div className="space-y-6 text-right max-w-md">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                            Join Sycapt Today
                        </div>
                        <h3 className="text-4xl font-extrabold text-white leading-tight">Empower Your <br /><span className="text-sycapt-red font-black text-5xl">Intelligence</span></h3>
                        <p className="text-white/40 text-base leading-relaxed">
                            เข้าร่วมเป็นส่วนหนึ่งของระบบจัดการความรู้อัจฉริยะ เพื่อสร้างสรรค์นวัตกรรมผ่านการเชื่อมโยงข้อมูล
                        </p>
                        <div className="flex justify-end gap-2 pt-4">
                            <div className="w-16 h-1 bg-sycapt-red rounded-full"></div>
                            <div className="w-8 h-1 bg-white/20 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* SLIDING FORM PANEL */}
                <div className={`absolute top-0 w-2/5 h-full z-20 flex transition-all duration-700 cubic-bezier(0.645, 0.045, 0.355, 1) will-change-transform ${isLogin ? 'left-[60%]' : 'left-0'}`}>
                    <div className="w-full h-full bg-white shadow-2xl flex flex-col relative">
                        {/* Red Accent Header - Compact */}
                        <div className="bg-sycapt-red pt-10 pb-8 px-8 text-white text-center relative overflow-hidden flex-shrink-0">
                            {/* Version Badge */}
                            <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm border border-white/20 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide text-white uppercase shadow-sm">
                                Version 2.0
                            </div>

                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                            <div className="bg-white px-8 py-5 rounded-[2rem] w-fit mx-auto shadow-2xl mb-5 transform hover:rotate-2 transition-transform border border-white/20">
                                <Logo className="h-8" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight mb-1 animate-in slide-in-from-bottom-2">
                                {isLogin ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <p className="text-white/60 text-[10px] font-medium tracking-wide uppercase">
                                {isLogin ? 'Sign in with Email or Username' : 'Register New User'}
                            </p>
                        </div>

                        {/* Form Body - Compact & No Scroll */}
                        <div className="p-8 flex-grow flex flex-col bg-gray-50/50 overflow-hidden">
                            {error && (
                                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-xs font-semibold animate-in zoom-in-95 duration-200">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4 flex-grow flex flex-col">
                                {!isLogin && (
                                    <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-right-4 duration-500">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    required={!isLogin}
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/5 outline-none transition-all text-xs font-medium shadow-sm"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Dept.</label>
                                            <div className="relative">
                                                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    value={department}
                                                    onChange={(e) => setDepartment(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/5 outline-none transition-all text-xs font-medium shadow-sm"
                                                    placeholder="e.g. Finance"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                            {isLogin ? 'Email or Username' : 'Email Address'}
                                        </label>
                                        <div className="relative">
                                            {isLogin ? (
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            ) : (
                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            )}
                                            <input
                                                type={isLogin ? "text" : "email"}
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/5 outline-none transition-all text-xs font-medium shadow-sm"
                                                placeholder={isLogin ? "email or username" : "email@company.com"}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-sycapt-red focus:ring-4 focus:ring-sycapt-red/5 outline-none transition-all text-xs font-medium shadow-sm"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-sycapt-red text-white py-2.5 rounded-xl font-black text-sm shadow-lg shadow-sycapt-red/10 hover:bg-black hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden group mt-2 h-11"
                                >
                                    {loading ? (
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="tracking-wide uppercase text-xs">{isLogin ? 'Sign In' : 'Create Account'}</span>
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                                        </>
                                    )}
                                </button>

                                <div className="pt-3 text-center text-[11px]">
                                    <span className="text-gray-400 font-medium">{isLogin ? "ยังไม่เป็นสมาชิก?" : "เป็นสมาชิกอยู่แล้ว?"}</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsLogin(!isLogin)}
                                        className="ml-2 text-sycapt-red font-black hover:underline cursor-pointer transition-colors"
                                    >
                                        {isLogin ? 'ลงทะเบียนที่นี่' : 'เข้าสู่ระบบ'}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center opacity-60">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[7px] font-black uppercase tracking-tighter">Powered by</span>
                                    <span className="text-[9px] font-black text-sycapt-dark tracking-tighter">Sycapt Intelligence Core</span>
                                </div>
                                <ShieldCheck size={18} className="text-green-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
