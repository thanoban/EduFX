from app.rag import retriever


class _FakeResult:
    def __init__(self, rows):
        self.data = rows


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, _columns):
        return self

    def eq(self, _column, _value):
        return self

    def execute(self):
        return _FakeResult(self._rows)


class _FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, _name):
        return _FakeQuery(self._rows)


def test_cosine_similarity_identical_vectors_is_one():
    vec = [1.0, 2.0, 3.0]
    assert retriever._cosine_similarity(vec, vec) == 1.0


def test_cosine_similarity_zero_vector_is_zero_not_nan():
    assert retriever._cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_parse_embedding_handles_pgvector_text_format():
    assert retriever._parse_embedding("[0.1,-0.2,0.3]") == [0.1, -0.2, 0.3]


def test_retrieve_ranks_chunks_by_similarity(monkeypatch):
    monkeypatch.setattr(retriever, "embed", lambda query, task_type=None: [1.0, 0.0])

    rows = [
        {"chunk_text": "off-topic", "embedding": "[0.0,1.0]"},
        {"chunk_text": "on-topic", "embedding": "[1.0,0.0]"},
        {"chunk_text": "somewhat related", "embedding": "[0.7,0.7]"},
    ]
    client = _FakeClient(rows)

    result = retriever.retrieve("query", subtopic_id=1, client=client, top_k=2)

    assert result == ["on-topic", "somewhat related"]


def test_retrieve_returns_empty_list_when_embedding_fails(monkeypatch):
    def _raise(*_args, **_kwargs):
        raise RuntimeError("embedding provider unavailable")

    monkeypatch.setattr(retriever, "embed", _raise)
    client = _FakeClient([])

    assert retriever.retrieve("query", subtopic_id=1, client=client) == []


def test_retrieve_returns_empty_list_when_table_select_fails(monkeypatch):
    monkeypatch.setattr(retriever, "embed", lambda query, task_type=None: [1.0, 0.0])

    class _BrokenClient:
        def table(self, _name):
            raise RuntimeError("network error")

    assert retriever.retrieve("query", subtopic_id=1, client=_BrokenClient()) == []


def test_retrieve_skips_rows_with_null_embedding(monkeypatch):
    monkeypatch.setattr(retriever, "embed", lambda query, task_type=None: [1.0, 0.0])

    rows = [
        {"chunk_text": "no embedding yet", "embedding": None},
        {"chunk_text": "has embedding", "embedding": "[1.0,0.0]"},
    ]
    client = _FakeClient(rows)

    assert retriever.retrieve("query", subtopic_id=1, client=client) == ["has embedding"]
