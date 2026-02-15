"use client";

import React from "react";

interface Props {
  palette: React.ReactNode;
  canvas: React.ReactNode;
  properties: React.ReactNode;
  metadataBar: React.ReactNode;
}

export default function EditorLayout({ palette, canvas, properties, metadataBar }: Props) {
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] -m-8">
      <div className="border-b border-gray-800 p-4">{metadataBar}</div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-gray-800 overflow-y-auto p-3">{palette}</aside>
        <main className="flex-1 overflow-y-auto p-4">{canvas}</main>
        <aside className="w-80 border-l border-gray-800 overflow-y-auto p-4">{properties}</aside>
      </div>
    </div>
  );
}
