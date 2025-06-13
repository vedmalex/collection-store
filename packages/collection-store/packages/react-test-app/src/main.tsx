import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css'
import { CollectionStoreProvider } from '@collection-store/browser-sdk/adapters/react/CollectionStoreContext';
import { BrowserCollectionManager } from '@collection-store/browser-sdk/collection/BrowserCollectionManager';
import { useCollection } from '@collection-store/browser-sdk/adapters/react/hooks/useCollection';
import { generateMockUsers } from '@collection-store/shared-test-utils';

// Initialize BrowserCollectionManager
const collectionManager = new BrowserCollectionManager();

const TestApp: React.FC = () => {
  const { data: users, isLoading, error, write, remove } = useCollection('users');

  React.useEffect(() => {
    // Populate with some initial data if needed for demonstration
    if (!isLoading && (!users || users.length === 0)) {
      const mockUsers = generateMockUsers(5);
      mockUsers.forEach(user => write(user.id, user));
    }
  }, [isLoading, users, write]);

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container">
      <h1>React Test App with Collection Store</h1>
      <h2>Users</h2>
      <ul>
        {users?.map((user: any) => (
          <li key={user.id}>
            {user.name} ({user.email})
            <button onClick={() => remove(user.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <button onClick={() => write(String(Date.now()), { id: String(Date.now()), name: 'New User', email: 'new@example.com', age: 30 })}>Add New User</button>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <CollectionStoreProvider collectionManager={collectionManager}>
      <TestApp />
    </CollectionStoreProvider>
  </React.StrictMode>
);
