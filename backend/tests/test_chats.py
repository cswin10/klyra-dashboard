"""
Tests for chat endpoints.
"""
import pytest
from models import Chat, Message, MessageRole


class TestChatCreation:
    """Tests for chat creation."""

    def test_create_chat(self, client, auth_headers):
        """Should create a new chat."""
        response = client.post(
            "/api/chats",
            json={"title": "Test Chat"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Chat"
        assert "id" in data

    def test_create_chat_without_title(self, client, auth_headers):
        """Should create a chat without title."""
        response = client.post(
            "/api/chats",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data


class TestChatListing:
    """Tests for chat listing."""

    def test_list_chats_empty(self, client, auth_headers):
        """Should return empty list when no chats exist."""
        response = client.get("/api/chats", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_chats_with_chats(self, client, auth_headers):
        """Should return list of user's chats."""
        # Create some chats
        client.post("/api/chats", json={"title": "Chat 1"}, headers=auth_headers)
        client.post("/api/chats", json={"title": "Chat 2"}, headers=auth_headers)

        response = client.get("/api/chats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_chats_isolated_per_user(self, client, auth_headers, admin_headers):
        """Users should only see their own chats."""
        # Create chat as regular user
        client.post("/api/chats", json={"title": "User Chat"}, headers=auth_headers)

        # Create chat as admin
        client.post("/api/chats", json={"title": "Admin Chat"}, headers=admin_headers)

        # Regular user should only see their chat
        response = client.get("/api/chats", headers=auth_headers)
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "User Chat"

        # Admin should only see their chat
        response = client.get("/api/chats", headers=admin_headers)
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Admin Chat"


class TestChatRetrieval:
    """Tests for retrieving a specific chat."""

    def test_get_chat(self, client, auth_headers):
        """Should retrieve a specific chat."""
        # Create a chat
        create_response = client.post(
            "/api/chats",
            json={"title": "Test Chat"},
            headers=auth_headers
        )
        chat_id = create_response.json()["id"]

        # Retrieve it
        response = client.get(f"/api/chats/{chat_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Chat"
        assert data["id"] == chat_id

    def test_get_nonexistent_chat(self, client, auth_headers):
        """Should return 404 for non-existent chat."""
        response = client.get(
            "/api/chats/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_cannot_access_other_users_chat(self, client, auth_headers, admin_headers):
        """User should not be able to access another user's chat."""
        # Create chat as admin
        create_response = client.post(
            "/api/chats",
            json={"title": "Admin Chat"},
            headers=admin_headers
        )
        chat_id = create_response.json()["id"]

        # Try to access as regular user
        response = client.get(f"/api/chats/{chat_id}", headers=auth_headers)
        assert response.status_code == 404


class TestChatDeletion:
    """Tests for chat deletion."""

    def test_delete_chat(self, client, auth_headers):
        """Should delete a chat."""
        # Create a chat
        create_response = client.post(
            "/api/chats",
            json={"title": "Test Chat"},
            headers=auth_headers
        )
        chat_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/api/chats/{chat_id}", headers=auth_headers)
        assert response.status_code == 200

        # Verify it's gone
        response = client.get(f"/api/chats/{chat_id}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_nonexistent_chat(self, client, auth_headers):
        """Should return 404 when deleting non-existent chat."""
        response = client.delete(
            "/api/chats/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_cannot_delete_other_users_chat(self, client, auth_headers, admin_headers):
        """User should not be able to delete another user's chat."""
        # Create chat as admin
        create_response = client.post(
            "/api/chats",
            json={"title": "Admin Chat"},
            headers=admin_headers
        )
        chat_id = create_response.json()["id"]

        # Try to delete as regular user
        response = client.delete(f"/api/chats/{chat_id}", headers=auth_headers)
        assert response.status_code == 404


class TestChatExport:
    """Tests for chat export."""

    def test_export_chat(self, client, auth_headers, db, test_user):
        """Should export a chat with messages."""
        # Create a chat
        create_response = client.post(
            "/api/chats",
            json={"title": "Export Test"},
            headers=auth_headers
        )
        chat_id = create_response.json()["id"]

        # Add messages directly to DB (simulating conversation)
        from models import Message, MessageRole
        user_msg = Message(
            chat_id=chat_id,
            role=MessageRole.user,
            content="Hello"
        )
        assistant_msg = Message(
            chat_id=chat_id,
            role=MessageRole.assistant,
            content="Hi there!",
            sources=["doc1.pdf"]
        )
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()

        # Export
        response = client.get(f"/api/chats/{chat_id}/export", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Export Test"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["content"] == "Hello"
        assert data["messages"][1]["sources"] == ["doc1.pdf"]
