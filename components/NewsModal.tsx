
import React from 'react';
import { XMarkIcon, MegaphoneIcon } from './Icons.tsx';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FeatureComparisonItem {
  feature: string;
  paidUser: string | React.ReactNode;
  demoUser: string | React.ReactNode;
  category?: string; // Optional category for grouping
}

const featureComparisonData: FeatureComparisonItem[] = [
  { category: "General Chat Models", feature: "Gemini (Flash & Advanced)", paidUser: "✅ Full Access", demoUser: "✅ Full Access" },
  { feature: "ChatGPT (gpt-4.1 & mini)", paidUser: "✅ Full Access", demoUser: "✅ Full Access (Code required for gpt-4.1)" },
  { feature: "Deepseek", paidUser: "✅ Full Access", demoUser: "✅ Full Access" },
  { feature: "Claude (Mock)", paidUser: "✅ Mock Access", demoUser: "✅ Mock Access" },
  { feature: "AI Agent (Gemini)", paidUser: "✅ Full Access", demoUser: "✅ Full Access" },
  { feature: "Private Mode (Local)", paidUser: "✅ Full Access", demoUser: "✅ Full Access" },
  { category: "Image Generation", feature: "Imagen3", paidUser: "1 image/day", demoUser: "5 images/month" },
  { feature: "Flux1.1 [Ultra]", paidUser: "30 images/month", demoUser: <span className="text-red-500 dark:text-red-400">❌ Paid Only</span> },
  { category: "Image Editing", feature: "Flux Kontext Pro", paidUser: <span>35 uses/month <br/><small>(1 image input/use)</small></span>, demoUser: <span>1 use/month <br/><small>(1 image input/use)</small></span> },
  { feature: "Flux Kontext Max", paidUser: <span>25 uses/month <br/><small>(up to 4 image inputs/use)</small></span>, demoUser: <span className="text-red-500 dark:text-red-400">❌ Paid Only</span> },
  { category: "Video Generation", feature: "Kling AI Video", paidUser: "1 generation/month", demoUser: <span className="text-red-500 dark:text-red-400">❌ Paid Only</span> },
  { category: "Text-to-Speech (TTS)", feature: "OpenAI TTS", paidUser: "20,000 chars/use (fair use)", demoUser: "10,000 chars/month" },
  { category: "Real-Time Translation", feature: "Gemini Translation", paidUser: "✅ Full Access (incl. voice output)", demoUser: "✅ Full Access (voice output disabled)" },
  { category: "Other Features", feature: "Web Search (Gemini)", paidUser: "✅ Full Access", demoUser: "✅ Full Access" },
];


const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const promotionalImageUrl = "https://i.ibb.co/MkfbJgzt/45fc503f-f120-419e-90f0-1c0c8c6e740a.jpg";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[90] p-4 transition-opacity duration-300"
      onClick={onClose} 
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
    >
      <div
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl p-5 w-full max-w-md md:max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-secondary dark:border-neutral-darkest">
          <h2 id="news-modal-title" className="text-xl sm:text-2xl font-semibold text-primary dark:text-primary-light flex items-center">
            <MegaphoneIcon className="w-7 h-7 mr-2" /> Version 1.5 - Feature Comparison
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close news modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow space-y-4 text-sm text-neutral-700 dark:text-neutral-200 pr-1">
          <p className="mb-4 text-neutral-600 dark:text-neutral-300">
            Here's a summary of feature access for different user types. For DEMO access, please use a designated DEMO username (e.g., "guest_demo").
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left border-collapse">
              <thead className="border-b-2 border-secondary dark:border-neutral-darkest">
                <tr>
                  <th className="p-2 font-semibold text-neutral-darker dark:text-secondary-light bg-secondary/30 dark:bg-neutral-dark/30">Feature / Model</th>
                  <th className="p-2 font-semibold text-neutral-darker dark:text-secondary-light bg-secondary/30 dark:bg-neutral-dark/30">Paid User</th>
                  <th className="p-2 font-semibold text-neutral-darker dark:text-secondary-light bg-secondary/30 dark:bg-neutral-dark/30">Demo User ('guest_demo')</th>
                </tr>
              </thead>
              <tbody>
                {featureComparisonData.map((item, index) => (
                  <React.Fragment key={index}>
                    {item.category && (
                      <tr className="bg-secondary/10 dark:bg-neutral-dark/10">
                        <td colSpan={3} className="p-2 font-bold text-primary dark:text-primary-light text-md border-b border-secondary dark:border-neutral-darkest">
                          {item.category}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-secondary/50 dark:border-neutral-dark/50 hover:bg-secondary/20 dark:hover:bg-neutral-dark/20">
                      <td className="p-2 align-top">{item.feature}</td>
                      <td className="p-2 align-top">{item.paidUser}</td>
                      <td className="p-2 align-top">{item.demoUser}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-secondary/50 dark:border-neutral-dark/50">
            <img src={promotionalImageUrl} alt="Promotional Offer" className="w-full rounded-md shadow-md mb-3" />
            <p className="font-semibold text-md text-accent dark:text-accent-light text-center mb-1">
              Chỉ 200.000đ/tháng sử dụng không giới hạn!
            </p>
            <p className="text-neutral-600 dark:text-neutral-300 text-center mb-1">
              Sau khi chuyển khoản bạn cần:
            </p>
            <p className="text-center">
              <a
                href="https://www.facebook.com/herishop213"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
              >
                Liên hệ FB: Lee Thinh
              </a>
            </p>
            <p className="text-neutral-600 dark:text-neutral-300 text-center mt-1">
              Zalo: 0901984741
            </p>
            <p className="text-neutral-600 dark:text-neutral-300 text-center mt-1">
              Để được hỗ trợ tạo tài khoản riêng. Xin cám ơn!
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-secondary dark:border-neutral-darkest">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-light dark:ring-offset-neutral-darker focus:ring-primary-dark transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
