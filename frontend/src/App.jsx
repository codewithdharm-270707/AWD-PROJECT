import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Components Import
import Header from './Header/Header'; 
import Home from './Pages/Home';     
import Course from './Pages/Course'; 
import CourseDetail from './Pages/CourseDetail';
import Projects from './Pages/Projects'; 
import Login from './Form/Login';         // Login ઇમ્પોર્ટ કર્યું
import Register from './Form/Register';   // Register ઇમ્પોર્ટ કર્યું
import Certificate from './Certificate/Certificate'; // Certificate ઇમ્પોર્ટ કર્યું
import Dashboard from './Dashboard/Dashboard'; // 👈 Dashboard ઇમ્પોર્ટ કર્યું
import Footer from './Footer/Footer'; 

function App() {
  return (
    <Router>
      <div className="App">
        {/* Header બધી જગ્યાએ ઉપર દેખાશે */}
        <Header />
        
        {/* Routes setup */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/course" element={<Course />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/projects" element={<Projects />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Certificate Route */}
          <Route path="/certificate" element={<Certificate />} />

          {/* 👈 નવો Dashboard Route ઉમેર્યો (Admin, User, My Account માટે) */}
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>

        {/* Footer બધી જગ્યાએ નીચે દેખાશે */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;