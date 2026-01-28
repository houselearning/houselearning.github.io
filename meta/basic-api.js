    document.addEventListener("DOMContentLoaded", () => {
      const firebaseConfig = {
        apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
        authDomain: "contract-center-llc-10.firebaseapp.com",
        projectId: "contract-center-llc-10",
      };

      firebase.initializeApp(firebaseConfig);
      const auth = firebase.auth();

      auth.onAuthStateChanged(user => {
        if (user) {
          window.location.href = "dashboard.html";
        }
      });
    });
