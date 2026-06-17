import sys
import os
from unittest.mock import MagicMock

# 1. Pure Python MockTensor and MockTorch classes
class MockTensor:
    def __init__(self, data):
        self.data = data
    
    def __getitem__(self, item):
        if isinstance(self.data, list) and len(self.data) > 0 and isinstance(self.data[0], list):
            return MockTensor(self.data[item])
        return self.data[item]
        
    def __float__(self):
        if isinstance(self.data, list):
            flat = []
            def flatten(l):
                for x in l:
                    if isinstance(x, list):
                        flatten(x)
                    else:
                        flat.append(x)
            flatten(self.data)
            return sum(flat) / len(flat) if flat else 0.0
        return float(self.data)
        
    def __repr__(self):
        return f"MockTensor({self.data})"

class MockTorch:
    def max(self, tensor, dim=None):
        data = tensor.data if isinstance(tensor, MockTensor) else tensor
        if dim == 1:
            max_vals = [row[0] for row in data]
            indices = [0] * len(data)
            return MockTensor(max_vals), MockTensor(indices)
        return MockTensor(max(data)), MockTensor(0)

    def mean(self, tensor):
        data = tensor.data if isinstance(tensor, MockTensor) else tensor
        if isinstance(data, list):
            val = sum(data) / len(data) if data else 0.0
            return MockTensor(val)
        return MockTensor(data)

# 2. Pure Python MockModel and MockUtil for sentence_transformers
class MockModel:
    def encode(self, texts, convert_to_tensor=False):
        def get_single_vector(text):
            vec = [0.0] * 384
            words = [w.strip(".,;:?!()[]{}").lower() for w in text.split()]
            words = [w for w in words if len(w) > 2]
            for w in words:
                h = 0
                for char in w:
                    h = (h * 31 + ord(char)) & 0xFFFFFFFF
                idx = h % 384
                vec[idx] += 1.0
            
            mag = sum(x**2 for x in vec)**0.5
            if mag > 0:
                vec = [x / mag for x in vec]
            
            # Deterministic noise using LCG
            h_text = 0
            for char in text:
                h_text = (h_text * 31 + ord(char)) & 0xFFFFFFFF
            state = h_text
            noise = []
            for _ in range(384):
                state = (1103515245 * state + 12345) & 0xFFFFFFFF
                noise_val = (state / 0xFFFFFFFF) * 0.1
                noise.append(noise_val)
                
            vec = [v + n for v, n in zip(vec, noise)]
            mag = sum(x**2 for x in vec)**0.5
            if mag > 0:
                vec = [x / mag for x in vec]
            return vec

        if isinstance(texts, str):
            v = get_single_vector(texts)
            return MockTensor(v) if convert_to_tensor else v
        elif isinstance(texts, list):
            res = [get_single_vector(t) for t in texts]
            return MockTensor(res) if convert_to_tensor else res

class MockUtil:
    def pytorch_cos_sim(self, a, b):
        a_data = a.data if isinstance(a, MockTensor) else a
        b_data = b.data if isinstance(b, MockTensor) else b
        
        if not isinstance(a_data[0], list):
            a_matrix = [a_data]
        else:
            a_matrix = a_data
            
        if not isinstance(b_data[0], list):
            b_matrix = [b_data]
        else:
            b_matrix = b_data
            
        sim_matrix = []
        for vec_a in a_matrix:
            row = []
            for vec_b in b_matrix:
                dot = sum(x*y for x, y in zip(vec_a, vec_b))
                mag_a = sum(x**2 for x in vec_a)**0.5
                mag_b = sum(x**2 for x in vec_b)**0.5
                sim = dot / (mag_a * mag_b) if mag_a > 0 and mag_b > 0 else 0.0
                row.append(sim)
            sim_matrix.append(row)
            
        return MockTensor(sim_matrix)

sentence_transformers_mock = MagicMock()
sentence_transformers_mock.SentenceTransformer.return_value = MockModel()
sentence_transformers_mock.util = MockUtil()

sys.modules['sentence_transformers'] = sentence_transformers_mock
sys.modules['torch'] = MockTorch()

# 3. Pure Python Mock pdfplumber
class MockPage:
    def __init__(self, text):
        self.text = text
    def extract_text(self):
        return self.text

class MockPDF:
    def __init__(self, file_stream_or_path, *args, **kwargs):
        self.pages = [MockPage(
            "Alex McKinney\nSenior Full Stack Engineer\nReact, TypeScript, Node.js, PostgreSQL\n6.5 Years of experience. Stanford University.\nWorked on Omni-Channel FinTech SaaS."
        )]
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

pdfplumber_mock = MagicMock()
pdfplumber_mock.open = MockPDF
sys.modules['pdfplumber'] = pdfplumber_mock

# 4. Pure Python Mock spacy to avoid load errors
spacy_mock = MagicMock()
spacy_mock.load.return_value = MagicMock()
sys.modules['spacy'] = spacy_mock

# 5. Run uvicorn server
import uvicorn
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("Mock libraries registered successfully. Starting uvicorn...")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
