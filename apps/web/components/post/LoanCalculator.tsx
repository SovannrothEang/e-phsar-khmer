
export default function LoanCalculator() {
    return (
        <div className="bg-card rounded-sm p-4 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-[15px]">Loan Calculator</h3>
                <a href="#" className="text-[#00a0e9] text-[13px] font-medium hover:underline">Payment Schedule</a>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-8 px-2">
                <div className="relative w-32 h-32 rounded-full border-[10px] border-[#00a0e9] border-l-[#f68b1e] border-b-gray-200 flex items-center justify-center flex-col">
                    <span className="text-[22px] font-bold leading-none text-gray-800">1,947</span>
                    <span className="text-[10px] text-gray-600 mt-1">Per month</span>
                    <span className="text-[9px] text-[#00a0e9] font-medium">over 5 year</span>
                </div>
                <div className="flex-1 w-full text-[13px] pr-4">
                    <div className="space-y-2.5">
                        {[
                            { color: "#34a853", label: "Down Payment:", value: "$24,000" },
                            { color: "#00a0e9", label: "Loan Amount:", value: "$96,000" },
                            { color: "#fbbc05", label: "Total Interest:", value: "$20,793" },
                            { color: "#00a0e9", label: "Total Payment:", value: "$140,793" },
                        ].map(({ color, label, value }) => (
                            <div key={label} className="flex justify-between items-center">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full border-[3px]" style={{ borderColor: color }} />
                                    <span className="text-gray-600">{label}</span>
                                </div>
                                <span className="font-bold text-gray-800">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 w-full space-y-4">
                    <div>
                        <label className="text-[13px] text-gray-600 mb-1.5 block">Down Payment</label>
                        <div className="flex">
                            <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden flex-1 focus-within:border-[#00a0e9]">
                                <span className="px-3 text-sm text-gray-500 bg-gray-50 border-r border-gray-300 h-full flex items-center">$</span>
                                <input type="text" className="w-full text-sm px-3 py-1.5 focus:outline-none" defaultValue="24000" />
                            </div>
                            <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden w-20 ml-2 focus-within:border-[#00a0e9]">
                                <input type="text" className="w-full text-sm px-2 py-1.5 focus:outline-none text-center" defaultValue="20" />
                                <span className="px-2 text-sm text-gray-500 bg-gray-50 border-l border-gray-300 h-full flex items-center">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[13px] text-gray-600 mb-1.5 block">Term</label>
                            <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden focus-within:border-[#00a0e9]">
                                <input type="text" className="w-full text-sm px-3 py-1.5 focus:outline-none" defaultValue="5" />
                                <span className="px-3 text-sm text-gray-500 bg-gray-50 border-l border-gray-300 h-full flex items-center">year</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-[13px] text-gray-600 mb-1.5 block">Interest</label>
                            <div className="flex items-center border border-gray-300 rounded-sm overflow-hidden focus-within:border-[#00a0e9]">
                                <input type="text" className="w-full text-sm px-3 py-1.5 focus:outline-none" defaultValue="8" />
                                <span className="px-3 text-sm text-gray-500 bg-gray-50 border-l border-gray-300 h-full flex items-center">%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}