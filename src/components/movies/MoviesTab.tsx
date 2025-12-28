import { useState } from 'react';
import { Film, Library, Users, LayoutDashboard } from 'lucide-react';
import MoviesDashboard from './MoviesDashboard';
import ContentLibrary from './ContentLibrary';
import UserRequests from './UserRequests';

const MoviesTab = () => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'library' | 'requests'>('dashboard');

  const subTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Content Library', icon: Library },
    { id: 'requests', label: 'User Requests', icon: Users }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-4 sm:p-6 border border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg shadow-lg">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Movies & Series</h2>
            <p className="text-sm text-gray-400">Manage your content library and user requests</p>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeSubTab === tab.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeSubTab === 'dashboard' && <MoviesDashboard />}
        {activeSubTab === 'library' && <ContentLibrary />}
        {activeSubTab === 'requests' && <UserRequests />}
      </div>
    </div>
  );
};

export default MoviesTab;
