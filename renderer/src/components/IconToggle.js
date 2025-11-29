import React from 'react';

// IconToggle: small reusable icon toggle button
// Props:
// - enabled: boolean
// - onClick: function
// - EnabledIcon: React component for enabled state
// - DisabledIcon: React component for disabled state
// - enabledTitle, disabledTitle: tooltip text
// - className: additional classes
export default function IconToggle({ enabled, onClick, EnabledIcon, DisabledIcon, enabledTitle = 'Enabled', disabledTitle = 'Disabled', className = '' }) {
  const title = enabled ? enabledTitle : disabledTitle;
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded ${enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} ${className}`}
      title={title}
      aria-pressed={!!enabled}
      aria-label={title}
    >
      {enabled ? <EnabledIcon className="w-4 h-4" /> : <DisabledIcon className="w-4 h-4" />}
    </button>
  );
}

