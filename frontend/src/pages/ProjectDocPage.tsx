import React from 'react';
import FileExplorer from '../components/FileExplorer';

/**
 * Project documentation page with file structure
 */
const ProjectDocPage: React.FC = () => {
  return (
    <div className="max-w-screen-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ALA Project Documentation</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Project Structure</h2>
        <FileExplorer />
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Recent Changes</h2>
        <div className="bg-white p-4 border rounded-md">
          <h3 className="font-medium mb-2">Fixed Issues:</h3>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <span className="font-medium">API Path Mismatch</span>
              <p className="text-sm text-gray-600">Fixed incorrect path in authService.ts resendVerificationCode method</p>
            </li>
            <li>
              <span className="font-medium">Priority API Integration</span>
              <p className="text-sm text-gray-600">Updated priorityService.ts to properly handle API connections</p>
            </li>
            <li>
              <span className="font-medium">TypeScript Errors</span>
              <p className="text-sm text-gray-600">Fixed type errors in server.ts route handling</p>
            </li>
            <li>
              <span className="font-medium">Debugging Tools</span>
              <p className="text-sm text-gray-600">Added scripts/debug.js, debug.bat, debug.sh, and restart.bat utilities</p>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">How to Run the Application</h2>
        <div className="bg-white p-4 border rounded-md">
          <h3 className="font-medium mb-2">Development Mode:</h3>
          <pre className="bg-gray-100 p-3 rounded my-2 overflow-x-auto">
            docker-compose -f docker-compose.dev.yml up -d
          </pre>
          
          <h3 className="font-medium mb-2 mt-4">Production Mode:</h3>
          <pre className="bg-gray-100 p-3 rounded my-2 overflow-x-auto">
            docker-compose -f docker-compose.prod.yml up -d
          </pre>
          
          <h3 className="font-medium mb-2 mt-4">Restart Containers:</h3>
          <pre className="bg-gray-100 p-3 rounded my-2 overflow-x-auto">
            .\restart.bat
          </pre>
          
          <h3 className="font-medium mb-2 mt-4">Debugging:</h3>
          <pre className="bg-gray-100 p-3 rounded my-2 overflow-x-auto">
            .\debug.bat
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ProjectDocPage;
