import React from 'react';

// IconAction: small reusable icon button (single icon)
// Props:
// - onClick: function
// - Icon: React component
// - title: tooltip
// - className: additional classes
export default function IconAction({ onClick, Icon, title = '', className = '' }) {
  return (
    <button onClick={onClick} className={`p-2 rounded bg-gray-100 text-gray-700 ${className}`} title={title} aria-label={title}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

