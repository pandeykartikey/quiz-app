# 🎯 Real-Time Quiz App

A local network real-time quiz application built with Node.js, Express, Socket.IO, and Tailwind CSS. Perfect for parties, classrooms, or team building events!

## ✨ Features

- **Real-time multiplayer quiz** with live updates
- **Local network access** - works on any device connected to the same Wi-Fi
- **QR code generation** for easy joining
- **Live leaderboard** with real-time scoring
- **Responsive design** optimized for mobile and desktop
- **Host controls** for quiz management
- **Customizable questions** via JSON file

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will display:
- Local access URL: `http://localhost:3000`
- Network access URL: `http://[your-ip]:3000`
- Access code for players to join

### 3. Host the Quiz

1. **Host Access**: Visit `http://localhost:3000?host=true` to access host controls
2. **Player Access**: Players visit the network URL and enter the access code
3. **QR Code**: Host screen shows a QR code for easy player joining

## 🛠️ Development

### Development Mode

```bash
npm run dev
```

This starts the server with auto-reload using Nodemon.

### Frontend Development

```bash
npm run dev-frontend
```

Starts Vite dev server for frontend development with hot reload.

### Build for Production

```bash
npm run build
```

Builds optimized assets for production.

## 📁 Project Structure

```
quiz-app/
├── package.json          # Dependencies and scripts
├── server.js             # Express/Socket.IO server
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── /public               # Static frontend files
│   ├── index.html        # Main HTML file
│   ├── main.js          # Client-side JavaScript
│   ├── styles.css       # Tailwind CSS styles
│   └── /assets          # Images, videos, etc.
├── /data
│   └── quiz.json        # Quiz questions and content
└── /src                 # Source files (optional)
```

## 🎮 How to Play

### For the Host:

1. Open `http://localhost:3000?host=true`
2. Share the QR code or network URL with players
3. Wait for players to join
4. Click "Start Quiz" when ready
5. Click "Next Question" to advance through the quiz
6. View real-time leaderboard and player progress

### For Players:

1. Visit the network URL or scan the QR code
2. Enter your name and the access code
3. Wait in the lobby for the quiz to start
4. Answer questions as they appear
5. View your live ranking on the leaderboard

## 📝 Customizing Questions

Edit `data/quiz.json` to add your own questions:

```json
{
  "title": "My Custom Quiz",
  "description": "A quiz about...",
  "questions": [
    {
      "id": 1,
      "text": "What is the capital of France?",
      "choices": ["London", "Berlin", "Paris", "Madrid"],
      "correctChoice": 2,
      "explanation": "Paris is the capital of France.",
      "media": "assets/paris.jpg"
    }
  ]
}
```

### Question Properties:

- **id**: Unique identifier (number)
- **text**: The question text (string)
- **choices**: Array of answer options (array of strings)
- **correctChoice**: Index of correct answer (number, 0-based)
- **explanation**: Optional explanation shown after answering (string)
- **media**: Optional image/video path relative to public folder (string)

## 🌐 Network Setup

### Finding Your Local IP:

**Windows:**
```bash
ipconfig
```

**Mac/Linux:**
```bash
ifconfig
```

Look for your local IP address (usually starts with 192.168.x.x or 10.x.x.x).

### Firewall Settings:

Make sure port 3000 is open for incoming connections on your local network.

**Windows:**
- Windows Defender Firewall → Allow an app through firewall
- Add Node.js or allow port 3000

**Mac:**
- System Preferences → Security & Privacy → Firewall
- Allow Node.js connections

## 🔧 Configuration

### Environment Variables:

Create a `.env` file to customize settings:

```env
PORT=3000
NODE_ENV=production
```

### Server Configuration:

The server automatically:
- Binds to all network interfaces (`0.0.0.0`)
- Generates unique access codes for each session
- Handles player connections and disconnections
- Manages quiz state and scoring

## 🎨 Customization

### Styling:

Modify `tailwind.config.js` to customize colors and design:

```javascript
theme: {
  extend: {
    colors: {
      'quiz-primary': '#3B82F6',    // Blue
      'quiz-secondary': '#10B981',  // Green
      'quiz-accent': '#F59E0B',     // Yellow
      'quiz-danger': '#EF4444'      // Red
    }
  }
}
```

### Adding Media:

1. Place images/videos in `public/assets/`
2. Reference them in quiz questions: `"media": "assets/your-image.jpg"`

## 🔍 Troubleshooting

### Common Issues:

**Players can't connect:**
- Check that all devices are on the same Wi-Fi network
- Verify firewall settings allow port 3000
- Try accessing by IP address instead of localhost

**Quiz not loading:**
- Ensure `data/quiz.json` is valid JSON
- Check browser console for JavaScript errors
- Verify all dependencies are installed

**Socket.IO connection issues:**
- Make sure port 3000 is not blocked
- Check that the server is running and accessible
- Refresh the browser page

### Debug Mode:

Start with debug logging:

```bash
DEBUG=socket.io* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- **Socket.IO** for real-time communication
- **Tailwind CSS** for beautiful styling
- **Express.js** for robust server framework
- **Vite** for fast development builds
- **QRCode.js** for QR code generation

---

**Made with ❤️ for local network fun!** 