
import React from 'react';
import { XMarkIcon, MegaphoneIcon } from './Icons.tsx'; // Assuming MegaphoneIcon is in Icons.tsx

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const updates = [
    {
      title: "Flux Kontext Max (Advanced image editing) features:",
      points: [
        "Upload up to 4 images for editing requests.",
        "80 images/month for paid users.",
        "Not available for DEMO users."
      ]
    },
    {
      title: "Flux Kontext Pro (image editing) features:",
      points: [
        "Upload up to 1 image for editing requests.",
        "15 images per day for paid users.",
        "DEMO users: 2 images trial."
      ]
    },
    {
      title: "Text to Speech:",
      points: [
        "DEMO users: Max 5,000 characters.",
        "Paid users: 20,000 characters."
      ]
    },
    {
      title: "Real-Time Voice Translate:",
      points: [
        "Voice output disabled for DEMO users."
      ]
    }
  ];

  const promotionalImageUrl = "https://i.ibb.co/MkfbJgzt/45fc503f-f120-419e-90f0-1c0c8c6e740a.jpg";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[90] p-4 transition-opacity duration-300"
      onClick={onClose} // Click on backdrop closes modal
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
    >
      <div
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl p-6 w-full max-w-md md:max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-secondary dark:border-neutral-darkest">
          <h2 id="news-modal-title" className="text-xl sm:text-2xl font-semibold text-primary dark:text-primary-light flex items-center">
            <MegaphoneIcon className="w-7 h-7 mr-2" /> New Updates (Version 1.2)
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close news modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow space-y-4 text-sm text-neutral-700 dark:text-neutral-200 pr-2">
          {updates.map((update, index) => (
            <div key={index}>
              <h3 className="font-semibold text-md text-neutral-darker dark:text-secondary-light mb-1">{index + 1}. {update.title}</h3>
              <ul className="list-disc list-inside pl-4 space-y-0.5 text-neutral-600 dark:text-neutral-300">
                {update.points.map((point, pIndex) => (
                  <li key={pIndex}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-secondary/50 dark:border-neutral-dark/50">
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
