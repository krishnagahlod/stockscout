import Link from "next/link";

export default function DisclaimerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-5 py-8 md:px-8">
      <div className="mx-auto mb-6 max-w-4xl">
        <Link href="/" className="text-sm font-medium text-indigo-600 underline">Back to StockScout</Link>
      </div>
      {children}
    </div>
  );
}
