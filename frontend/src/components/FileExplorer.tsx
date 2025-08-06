import React, { useState } from 'react';

// Note: This component requires Lucide React to be installed
// If it's not already part of your project, install it with:
// npm install lucide-react

interface FileNode {
  name: string;
  path?: string;
  highlight?: boolean;
  children?: FileNode[];
}

/**
 * FileExplorer component to visualize project structure
 * Can be used for documentation or development guides
 */
const FileExplorer: React.FC = () => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    root: true,
    backend: true,
    'backend/src': true,
    'frontend': true,
    'frontend/src': true,
    'frontend/src/services': true,
    'scripts': true,
    'azure': false,
    'docs': false
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders({
      ...expandedFolders,
      [folder]: !expandedFolders[folder]
    });
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Use CSS classes and check if lucide icons are available
    // Fallback to simple text if icons aren't available
    switch(extension) {
      case 'ts':
      case 'tsx':
        return <span className="text-blue-500 mr-2">[TS]</span>;
      case 'js':
      case 'jsx':
        return <span className="text-yellow-500 mr-2">[JS]</span>;
      case 'json':
        return <span className="text-green-500 mr-2">[JSON]</span>;
      case 'md':
        return <span className="text-gray-500 mr-2">[MD]</span>;
      case 'yml':
      case 'yaml':
        return <span className="text-purple-500 mr-2">[YML]</span>;
      case 'bat':
      case 'sh':
        return <span className="text-red-500 mr-2">[SH]</span>;
      case 'css':
        return <span className="text-blue-400 mr-2">[CSS]</span>;
      case 'html':
        return <span className="text-orange-500 mr-2">[HTML]</span>;
      default:
        return <span className="text-gray-400 mr-2">[FILE]</span>;
    }
  };

  const renderFiles = (files: FileNode[], indent = 0) => {
    return files.map((file, index) => {
      const isFolder = file.children !== undefined;
      const path = file.path || file.name;
      const isExpanded = isFolder && expandedFolders[path];
      
      return (
        <div key={index}>
          <div 
            className={`flex items-center py-1 hover:bg-gray-100 ${file.highlight ? 'bg-yellow-100' : ''}`}
            style={{ paddingLeft: `${indent * 16}px` }}
          >
            {isFolder ? (
              <span 
                className="flex items-center cursor-pointer" 
                onClick={() => toggleFolder(path)}
              >
                {isExpanded ? 
                  <span className="text-gray-500 mr-1">▼</span> : 
                  <span className="text-gray-500 mr-1">▶</span>
                }
                <span className="text-yellow-600 mr-2">📁</span>
                <span className="text-sm">{file.name}</span>
              </span>
            ) : (
              <span className="flex items-center">
                <span className="w-4"></span>
                {getFileIcon(file.name)}
                <span className="text-sm">{file.name}</span>
              </span>
            )}
          </div>
          
          {isFolder && isExpanded && file.children && renderFiles(file.children, indent + 1)}
        </div>
      );
    });
  };

  // Define the project structure
  const projectFiles: FileNode[] = [
    {
      name: 'ala-improved',
      path: 'root',
      children: [
        {
          name: '.env.docker',
          highlight: false
        },
        {
          name: '.gitignore',
          highlight: false
        },
        {
          name: 'azure',
          children: [
            { name: 'azure-deploy.sh' },
            { name: 'deploy.ps1' },
            { name: 'README.md' }
          ]
        },
        {
          name: 'backend',
          children: [
            { name: 'Dockerfile' },
            { name: 'package.json' },
            { 
              name: 'src',
              path: 'backend/src',
              children: [
                {
                  name: 'config',
                  children: [
                    { name: 'database.ts' }
                  ]
                },
                {
                  name: 'controllers',
                  children: [
                    { name: 'authController.ts', highlight: true }
                  ]
                },
                {
                  name: 'middleware',
                  children: [
                    { name: 'authMiddleware.ts' },
                    { name: 'errorMiddleware.ts' },
                    { name: 'notFoundMiddleware.ts' }
                  ]
                },
                {
                  name: 'models',
                  children: [
                    { name: 'Applicator.ts' },
                    { name: 'index.ts' },
                    { name: 'Treatment.ts' },
                    { name: 'User.ts' }
                  ]
                },
                {
                  name: 'routes',
                  children: [
                    { name: 'adminRoutes.ts' },
                    { name: 'applicatorRoutes.ts' },
                    { name: 'authRoutes.ts', highlight: true },
                    { name: 'treatmentRoutes.ts' }
                  ]
                },
                {
                  name: 'utils',
                  children: [
                    { name: 'logger.ts' }
                  ]
                },
                { name: 'seedUser.js' },
                { name: 'seedUser.ts' },
                { name: 'server.ts', highlight: true }
              ]
            },
            { name: 'tsconfig.json' }
          ]
        },
        {
          name: 'debug.bat',
          highlight: true
        },
        {
          name: 'debug.sh',
          highlight: true
        },
        {
          name: 'docker-compose.dev.yml',
          highlight: true
        },
        {
          name: 'docker-compose.prod.yml'
        },
        {
          name: 'docker-compose.yml'
        },
        {
          name: 'docs',
          children: [
            { name: 'IMPROVEMENTS.md' }
          ]
        },
        {
          name: 'frontend',
          children: [
            { name: 'Dockerfile' },
            { name: 'Dockerfile.dev' },
            { name: 'index.html' },
            { name: 'nginx.conf' },
            { name: 'package.json' },
            { name: 'postcss.config.js' },
            { 
              name: 'src',
              path: 'frontend/src',
              children: [
                { name: 'App.tsx' },
                {
                  name: 'components',
                  children: [
                    { name: 'FileExplorer.tsx', highlight: true },
                    { name: 'Layout.tsx' },
                    { name: 'ProtectedRoute.tsx' }
                  ]
                },
                {
                  name: 'context',
                  children: [
                    { name: 'AuthContext.tsx' },
                    { name: 'TreatmentContext.tsx' }
                  ]
                },
                { name: 'index.css' },
                { name: 'main.tsx' },
                {
                  name: 'pages',
                  children: [
                    { 
                      name: 'Admin',
                      children: [
                        { name: 'Dashboard.tsx' }
                      ]
                    },
                    { 
                      name: 'Auth',
                      children: [
                        { name: 'LoginPage.tsx' },
                        { name: 'VerificationPage.tsx' }
                      ]
                    },
                    { 
                      name: 'Treatment',
                      children: [
                        { name: 'ApplicatorInformation.tsx' },
                        { name: 'ScanQRCode.tsx' },
                        { name: 'SeedRemoval.tsx' },
                        { name: 'TreatmentSelection.tsx' },
                        { name: 'UseList.tsx' }
                      ]
                    }
                  ]
                },
                {
                  name: 'services',
                  path: 'frontend/src/services',
                  children: [
                    { name: 'api.ts', highlight: true },
                    { name: 'authService.ts', highlight: true },
                    { name: 'priorityService.ts', highlight: true },
                    { name: 'treatmentService.ts' }
                  ]
                }
              ]
            },
            { name: 'tailwind.config.js' },
            { name: 'tsconfig.json' },
            { name: 'tsconfig.node.json' },
            { name: 'vite.config.ts' }
          ]
        },
        {
          name: 'README.md'
        },
        {
          name: 'restart.bat',
          highlight: true
        },
        {
          name: 'scripts',
          children: [
            { name: 'debug.js', highlight: true }
          ]
        }
      ]
    }
  ];

  return (
    <div className="w-full h-full border rounded-md">
      <div className="bg-gray-100 border-b py-2 px-4 flex items-center">
        <span className="font-medium">📦 ALA Application Files</span>
      </div>
      <div className="p-2 bg-white overflow-auto" style={{height: "500px"}}>
        {renderFiles(projectFiles)}
      </div>
      <div className="bg-gray-100 border-t py-2 px-4 text-xs text-gray-500">
        Files highlighted in yellow were modified to fix the issues
      </div>
    </div>
  );
};

export default FileExplorer;
