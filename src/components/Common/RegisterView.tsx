import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, Building, AlertCircle, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
const bgRegister = new URL('../../../images/background/cyber2.846Z.png', import.meta.url).href;



interface RegisterViewProps {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onSuccess, onSwitchToLogin }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        department: '',
        role: 'user'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="flex items-center justify-center min-h-full bg-cover bg-center bg-no-repeat relative p-4"
            style={{ backgroundImage: `url(${bgRegister})` }}>
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-sycapt-dark/60 backdrop-blur-[2px]"></div>

            <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20 transform transition-all relative z-10">
                <div className="bg-sycapt-dark p-8 text-white relative overflow-hidden flex flex-col items-center">
                    <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-sycapt-red/20 rounded-full blur-2xl"></div>

                    <div className="bg-white p-3 rounded-2xl shadow-xl mb-5">
                        <Logo className="h-10" />
                    </div>

                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        Create Account
                    </h2>
                    <p className="mt-2 text-white/60 text-center">Join Sycapt AI to start managing your documents</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
                            <AlertCircle size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4 col-span-2">
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sycapt-red outline-none transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 col-span-2 sm:col-span-1">
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sycapt-red outline-none transition-all"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 col-span-2 sm:col-span-1">
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Department</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sycapt-red outline-none transition-all"
                                        placeholder="e.g. Finance"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 col-span-2">
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sycapt-red transition-colors" size={18} />
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sycapt-red outline-none transition-all"
                                        placeholder="Min 6 characters"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sycapt-dark text-white py-4 rounded-xl font-bold text-lg hover:bg-black hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? 'Registering...' : (
                            <>
                                Create Account
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <div className="text-center">
                        <p className="text-gray-500 text-sm">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={onSwitchToLogin}
                                className="text-sycapt-red font-bold hover:underline"
                            >
                                Sign In
                            </button>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
