from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class AuctionItem(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_items')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='items/')
    address = models.CharField(max_length=255, help_text='Pickup/Shipping address')
    starting_price = models.DecimalField(max_digits=12, decimal_places=2)
    buy_now_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.title} (#{self.pk})"

    @property
    def highest_bid(self):
        return self.bids.order_by('-amount', 'created_at').first()

    def can_accept_bids(self) -> bool:
        now = timezone.now()
        return self.is_active and self.starts_at <= now < self.ends_at

    @property
    def participants_count(self) -> int:
        return self.participants.count()


class Bid(models.Model):
    item = models.ForeignKey(AuctionItem, on_delete=models.CASCADE, related_name='bids')
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bids')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Bid {self.amount} on {self.item_id} by {self.bidder_id}"


class AuctionParticipant(models.Model):
    item = models.ForeignKey(AuctionItem, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auction_participations')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('item', 'user')

    def __str__(self) -> str:
        return f"Participant {self.user_id} in item {self.item_id}"


class Payment(models.Model):
    item = models.ForeignKey(AuctionItem, on_delete=models.CASCADE, related_name='payments')
    buyer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    provider = models.CharField(max_length=50, default='google_pay')
    provider_ref = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=30, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Payment {self.amount} for {self.item_id} ({self.status})"


class LedgerBlock(models.Model):
    index = models.PositiveIntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    previous_hash = models.CharField(max_length=64)
    data = models.JSONField()
    nonce = models.PositiveIntegerField(default=0)
    hash = models.CharField(max_length=64)

    class Meta:
        ordering = ['index']

    def __str__(self) -> str:
        return f"Block {self.index} {self.hash[:8]}"

# Create your models here.
