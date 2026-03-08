import boto3, json, os
from dotenv import load_dotenv
load_dotenv()

# Test InvokeModel API (which we know works) with different models
client = boto3.client(
    'bedrock-runtime',
    region_name='us-east-1',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
)

models = [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
]

for mid in models:
    try:
        body = json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 10,
            'messages': [{'role': 'user', 'content': 'Say hi'}]
        })
        resp = client.invoke_model(modelId=mid, body=body, contentType='application/json', accept='application/json')
        result = json.loads(resp['body'].read())
        print(f'OK  {mid}: {result["content"][0]["text"]}')
    except Exception as e:
        err = str(e)[:120]
        print(f'ERR {mid}: {err}')

# Also test langchain ChatBedrock with the model that works
print('\n--- LangChain ChatBedrock Test ---')
from langchain_aws import ChatBedrock

try:
    # Newer langchain-aws expects `model`
    llm = ChatBedrock(
        model="anthropic.claude-3-haiku-20240307-v1:0",
        region_name="us-east-1",
        model_kwargs={"temperature": 0.7, "max_tokens": 20},
    )
except TypeError:
    # Backward compatibility for older versions expecting `model_id`
    llm = ChatBedrock(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        region_name="us-east-1",
        model_kwargs={"temperature": 0.7, "max_tokens": 20},
    )

try:
    r = llm.invoke('Say hello in one word')
    print(f'OK  ChatBedrock: {r.content}')
except Exception as e:
    print(f'ERR ChatBedrock: {str(e)[:150]}')
