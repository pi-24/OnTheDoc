import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
