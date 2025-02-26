# Secure Chat Application Frontend

This is the frontend client for a secure chat application that provides real-time messaging with encryption and user status features.

## Features

- Real-time messaging interface
- End-to-end encryption using AES
- User presence detection (online/offline status)
- Typing indicators
- Message read receipts
- Clean and responsive UI built with React and Tailwind CSS
- User inactivity detection

## Technical Stack

- React.js with TypeScript
- Socket.IO Client for real-time communication
- CryptoJS for message encryption/decryption
- Tailwind CSS for styling

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Start the development server:
   ```
   yarn dev
   ```

## Security Implementation

The application implements end-to-end encryption using AES:
- Messages are encrypted on the sender's device
- Only encrypted messages are transmitted over the network
- Messages are decrypted on the recipient's device
- The encryption key is hardcoded as `SECRET_KEY` (in a production environment, this should be handled more securely)

## User Interface

### Login Screen
- Simple username entry to join the chat
- Clean gradient background

### Main Chat Interface
- User list with online/offline indicators and last seen timestamps
- Message bubbles with timestamps and read receipts
- Real-time typing indicators
- Message input area with send button

## User Experience Features

1. **User Status:**
   - Online/offline status indicators
   - "Last seen" timestamps for offline users

2. **Message Status:**
   - Sent indicators (single checkmark)
   - Read indicators (double checkmark)

3. **Activity Tracking:**
   - Automatically detects user activity (mouse movement, keyboard input, clicks)
   - Sets user to offline after 5 minutes of inactivity

4. **Visual Feedback:**
   - Selected user is highlighted in the user list
   - Messages from the current user appear on the right side in blue
   - Messages from other users appear on the left side in white
   - Typing indicators show when someone is composing a message

## State Management

The application manages several key pieces of state:
- Current user information
- List of available users and their status
- Selected conversation
- Message history organized by conversation
- Typing status

## Connection to Backend

The frontend connects to a Socket.IO server running at `http://localhost:8087`, which handles:
- User registration
- Message routing
- Conversation storage
- Status updates