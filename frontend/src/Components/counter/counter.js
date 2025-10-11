import React from 'react';
import { useParams } from 'react-router-dom';

const User = () => {
  const { name } = useParams();
  return (
    <div style={{ padding: 20 }}>
      <h1>Counter Dashboard</h1>
      <p>Signed in as: <strong>{name}</strong></p>
    </div>
  );
};

export default User;