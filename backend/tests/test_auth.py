"""Tests for PIN hashing and JWT token lifecycle."""
from coinco_rep.auth.service import create_session_token, decode_session_token, hash_pin, verify_pin


class TestPinHashing:
    def test_verify_correct_pin(self):
        h = hash_pin("1234")
        assert verify_pin("1234", h) is True

    def test_reject_wrong_pin(self):
        h = hash_pin("1234")
        assert verify_pin("9999", h) is False

    def test_different_hashes_for_same_pin(self):
        """bcrypt salts produce different hashes each time."""
        h1 = hash_pin("1234")
        h2 = hash_pin("1234")
        assert h1 != h2
        assert verify_pin("1234", h1) is True
        assert verify_pin("1234", h2) is True

    def test_reject_garbage_hash(self):
        assert verify_pin("1234", "not-a-hash") is False


class TestJWT:
    def test_encode_decode_roundtrip(self):
        token = create_session_token("person-1", "household-1")
        payload = decode_session_token(token)
        assert payload is not None
        assert payload["sub"] == "person-1"
        assert payload["household_id"] == "household-1"

    def test_invalid_token_returns_none(self):
        result = decode_session_token("garbage.token.here")
        assert result is None

    def test_tampered_token_returns_none(self):
        token = create_session_token("p1", "h1")
        tampered = token[:-5] + "XXXXX"
        assert decode_session_token(tampered) is None
