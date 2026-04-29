import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { DeckEditor } from './pages/DeckEditor';
import { Study } from './pages/Study';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deck/new" element={<DeckEditor />} />
          <Route path="/deck/:deckId/edit" element={<DeckEditor />} />
          <Route path="/study/:deckId" element={<Study />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
