import hashlib
from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone
from .models import Block, Item, Bid


def _hash_block_content(index: int, timestamp: str, event_type: str, payload: dict, previous_hash: str) -> str:
    base = {
        'index': index,
        'timestamp': timestamp,
        'event_type': event_type,
        'payload': payload,
        'previous_hash': previous_hash,
    }
    data = str(base).encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def append_block(event_type: str, payload: dict) -> Block:
    with transaction.atomic():
        last = Block.objects.order_by('-index').first()
        if last is None:
            prev_hash = '0'
            index = 0
        else:
            prev_hash = last.hash
            index = last.index + 1
        ts = timezone.now()
        ts_str = ts.isoformat()
        block_hash = _hash_block_content(index, ts_str, event_type, payload, prev_hash)
        block = Block.objects.create(
            index=index,
            timestamp=ts,
            event_type=event_type,
            payload=payload,
            previous_hash=prev_hash,
            hash=block_hash,
        )
        return block


def validate_chain() -> bool:
    prev = None
    for block in Block.objects.order_by('index').all():
        expected_hash = _hash_block_content(
            block.index,
            block.timestamp.isoformat(),
            block.event_type,
            block.payload,
            block.previous_hash,
        )
        if block.hash != expected_hash:
            return False
        if prev and block.previous_hash != prev.hash:
            return False
        prev = block
    return True


def try_activate_auction(item: Item, min_unique_bidders: int = 2, duration_hours: int = 24) -> Item:
    if item.is_active:
        return item
    unique_bidders = Bid.objects.filter(item=item).values_list('user_id', flat=True).distinct().count()
    if unique_bidders >= min_unique_bidders:
        item.is_active = True
        item.activated_at = timezone.now()
        item.end_at = item.activated_at + timedelta(hours=duration_hours)
        item.save(update_fields=['is_active', 'activated_at', 'end_at'])
        append_block('AUCTION_ACTIVATED', {'item_id': item.id, 'activated_at': item.activated_at.isoformat()})
    return item
