import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = "Đang tải dữ liệu..." }: LoadingSpinnerProps) {
  return (
    <div id="loading-spinner-container" className="flex flex-col items-center justify-center py-20 px-4 min-h-[40vh]">
      <div className="relative flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
        <div className="absolute w-16 h-16 rounded-full border-4 border-rose-500/10 animate-ping duration-1000"></div>
      </div>
      <p id="loading-spinner-message" className="muted-text mt-4 font-medium text-sm tracking-wide select-none">
        {message}
      </p>
    </div>
  );
}
