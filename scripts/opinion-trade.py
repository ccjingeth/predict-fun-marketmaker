#!/usr/bin/env python3
import argparse
import importlib
import sys


def load_client_class():
    module_candidates = [
        'opinion_clob_client',
        'opinion_clob_sdk',
        'opinion_clob_sdk.client',
        'opinion_clob_sdk.clob_client',
    ]

    for name in module_candidates:
        try:
            module = importlib.import_module(name)
            if hasattr(module, 'Client'):
                return module.Client
        except Exception:
            continue

    raise RuntimeError('Unable to import Opinion Client from opinion_clob_sdk')


def build_client(Client, args):
    try:
        return Client(
            host=args.host,
            chain_id=args.chain_id,
            private_key=args.private_key,
            api_key=args.api_key,
        )
    except Exception:
        try:
            return Client(args.host, args.chain_id, args.private_key, args.api_key)
        except Exception as exc:
            raise RuntimeError(f'Failed to create Opinion client: {exc}')


def place_order(client, args):
    order_args = {
        'token_id': args.token_id,
        'side': args.side,
        'price': float(args.price),
        'size': float(args.size),
    }

    if hasattr(client, 'place_order'):
        return client.place_order(**order_args)

    if hasattr(client, 'create_order') and hasattr(client, 'post_order'):
        order = client.create_order(order_args)
        return client.post_order(order)

    if hasattr(client, 'create_and_post_order'):
        return client.create_and_post_order(order_args)

    raise RuntimeError('No compatible order method found in Opinion client')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--token-id', dest='token_id', required=True)
    parser.add_argument('--side', required=True)
    parser.add_argument('--price', required=True)
    parser.add_argument('--size', required=True)
    parser.add_argument('--api-key', required=True)
    parser.add_argument('--private-key', required=True)
    parser.add_argument('--host', required=True)
    parser.add_argument('--chain-id', type=int, required=True)
    args = parser.parse_args()

    Client = load_client_class()
    client = build_client(Client, args)
    result = place_order(client, args)
    if result is None:
        print('Order submitted')
    else:
        print(result)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
