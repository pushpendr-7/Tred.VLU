from django.db import models
from django.contrib.auth.models import User


class Item(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='items')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='items/', blank=True, null=True)
    address = models.CharField(max_length=255, blank=True)
    start_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=False)
    activated_at = models.DateTimeField(blank=True, null=True)
    end_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Bid(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='bids')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bids')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Payment(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='payments')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    provider = models.CharField(max_length=50)
    status = models.CharField(max_length=30)
    raw_json = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Block(models.Model):
    index = models.PositiveIntegerField()
    timestamp = models.DateTimeField()
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    previous_hash = models.CharField(max_length=128)
    hash = models.CharField(max_length=128)

    class Meta:
        ordering = ['index']
