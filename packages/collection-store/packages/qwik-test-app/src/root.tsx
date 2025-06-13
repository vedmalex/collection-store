import { component$, useSignal, useVisibleTask$, useStore, $ } from '@builder.io/qwik';
import {
  QwikCollectionStoreProvider,
  useCollection,
} from '@collection-store/browser-sdk/adapters/qwik';
import {
  generateMockUser,
  measurePerformance,
} from '@collection-store/shared-test-utils';
import { v4 as uuidv4 } from 'uuid';

import { RouterOutlet, ServiceWorkerRegister } from '@builder.io/qwik-city';
import { RouterHead } from './components/router-head/router-head';

import './global.css';

interface User {
  id: string;
  name: string;
  email: string;
}

export const Root = component$(() => {
  return (
    <QwikCollectionStoreProvider dbName="qwik-test-db" defaultCollectionName="users">
      <AppContent />
    </QwikCollectionStoreProvider>
  );
});

export const AppContent = component$(() => {
  const users = useCollection<User>('users');
  const addCount = useSignal(0);
  const deleteCount = useSignal(0);
  const updateCount = useSignal(0);
  const addPerformance = useSignal(0);
  const deletePerformance = useSignal(0);
  const updatePerformance = useSignal(0);
  const totalUsers = useSignal(0);

  // biome-ignore lint/rules/exhaustiveDependencies: <explanation>
  useVisibleTask$(({ track }) => {
    track(() => users.items.length);
    totalUsers.value = users.items.length;
  });

  const handleAddUser = $(async () => {
    const newUser = generateMockUser();
    const performance = await measurePerformance(async () => {
      await users.add(newUser.id, newUser);
    });
    addPerformance.value = performance;
    addCount.value++;
  });

  const handleDeleteUser = $(async () => {
    if (users.items.length > 0) {
      const userToDelete = users.items[0];
      const performance = await measurePerformance(async () => {
        await users.delete(userToDelete.id);
      });
      deletePerformance.value = performance;
      deleteCount.value++;
    }
  });

  const handleUpdateUser = $(async () => {
    if (users.items.length > 0) {
      const userToUpdate = users.items[0];
      const updatedUser = { ...userToUpdate, name: `Updated ${uuidv4()}` };
      const performance = await measurePerformance(async () => {
        await users.update(updatedUser.id, updatedUser);
      });
      updatePerformance.value = performance;
      updateCount.value++;
    }
  });

  return (
    <>
      <RouterHead />
      <body lang="en">
        <main>
          <h1>Qwik Collection Store Test App</h1>
          <section>
            <h2>User Operations</h2>
            <button onClick$={handleAddUser}>Add User</button>
            <button onClick$={handleDeleteUser}>Delete User</button>
            <button onClick$={handleUpdateUser}>Update User</button>
            <p>Added: {addCount.value} (Avg Time: {addPerformance.value.toFixed(2)} ms)</p>
            <p>Deleted: {deleteCount.value} (Avg Time: {deletePerformance.value.toFixed(2)} ms)</p>
            <p>Updated: {updateCount.value} (Avg Time: {updatePerformance.value.toFixed(2)} ms)</p>
            <p>Total Users: {totalUsers.value}</p>
          </section>

          <section>
            <h2>Current Users</h2>
            <div class="user-list">
              {users.items.map((user: User) => (
                <div key={user.id} class="user-card">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <p>ID: {user.id}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
        <RouterOutlet />
        <ServiceWorkerRegister />
      </body>
    </>
  );
});
