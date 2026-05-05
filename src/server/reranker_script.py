import sys
import json
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

def rerank(query, documents, model_name='BAAI/bge-reranker-v2-m3'):
    """
    Reranks a list of documents based on a query using a Cross-Encoder.
    """
    try:
        # Load Model & Tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        model.eval()

        if torch.cuda.is_available():
            model.to('cuda')
        
        # Prepare pairs for the model
        pairs = [[query, doc] for doc in documents]
        
        # Tokenize
        with torch.no_grad():
            inputs = tokenizer(pairs, padding=True, truncation=True, return_tensors='pt', max_length=512)
            if torch.cuda.is_available():
                inputs = {k: v.to('cuda') for k, v in inputs.items()}
            
            # Compute scores
            scores = model(**inputs, return_dict=True).logits.view(-1,).float()
            
            # Normalize scores (Sigmoid)
            scores = torch.sigmoid(scores)
            
            # Convert to list
            scores = scores.cpu().numpy().tolist()
        
        return scores

    except Exception as e:
        sys.stderr.write(f"Error in reranking: {str(e)}\n")
        return []

if __name__ == "__main__":
    # Read input JSON from stdin
    # Expected format: { "query": "...", "documents": ["doc1 text...", "doc2 text..."] }
    try:
        input_data = sys.stdin.read()
        if not input_data:
            sys.exit(0)
            
        data = json.loads(input_data)
        query = data.get('query', "")
        documents = data.get('documents', [])
        
        if not query or not documents:
            print(json.dumps([]))
            sys.exit(0)

        scores = rerank(query, documents)
        
        # Return strict JSON array of scores
        print(json.dumps(scores))
        
    except Exception as e:
        sys.stderr.write(f"Critical Script Error: {str(e)}\n")
        sys.exit(1)
