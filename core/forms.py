from django import forms
from django.contrib.auth.models import User
from .models import Item, Bid


class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput())

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name']


class LoginForm(forms.Form):
    username = forms.CharField()
    password = forms.CharField(widget=forms.PasswordInput())


class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['title', 'description', 'image', 'address', 'start_price']


class BidForm(forms.ModelForm):
    class Meta:
        model = Bid
        fields = ['amount']
