import unittest
from unittest.mock import MagicMock

import psycopg

from app.database import check_database_connection


class DatabaseConnectivityTests(unittest.TestCase):
    def test_unconfigured_database_does_not_attempt_connection(self):
        connector = MagicMock()

        result = check_database_connection(None, 3, connector=connector)

        self.assertEqual(result.status, "not_configured")
        self.assertFalse(result.configured)
        connector.assert_not_called()

    def test_successful_connection_runs_a_minimal_readiness_query(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (1,)
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        connector = MagicMock()
        connector.return_value.__enter__.return_value = connection
        database_url = "postgresql://test:secret@localhost/test"

        result = check_database_connection(database_url, 5, connector=connector)

        self.assertEqual(result.status, "ready")
        connector.assert_called_once_with(database_url, connect_timeout=5)
        cursor.execute.assert_called_once_with("SELECT 1")

    def test_connection_failure_is_generic_and_does_not_echo_dsn(self):
        database_url = "postgresql://test:secret@db.example.test/clinic"
        connector = MagicMock(side_effect=psycopg.OperationalError(database_url))

        result = check_database_connection(database_url, 3, connector=connector)

        self.assertEqual(result.status, "unavailable")
        self.assertEqual(result.error, "database_unavailable")
        self.assertNotIn("secret", str(result.to_dict()))
        self.assertNotIn("db.example.test", str(result.to_dict()))

    def test_unexpected_query_result_is_not_reported_as_ready(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (0,)
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        connector = MagicMock()
        connector.return_value.__enter__.return_value = connection

        result = check_database_connection(
            "postgresql://test:secret@localhost/test",
            3,
            connector=connector,
        )

        self.assertEqual(result.status, "unavailable")
        self.assertEqual(result.error, "database_check_failed")


if __name__ == "__main__":
    unittest.main()
